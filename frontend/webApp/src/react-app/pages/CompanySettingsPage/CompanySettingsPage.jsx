import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { baseApi } from '@shared/app/api/baseApi.js';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
} from '../../features/worktrack/worktrackApi.js';
import './CompanySettingsPage.css';

export function CompanySettingsPage() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const { t } = useI18n();
  const { data, error, isLoading } = useGetCompanySettingsQuery();
  const [updateCompanySettings, updateState] = useUpdateCompanySettingsMutation();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const company = data?.company || null;
  const normalizedName = name.trim();
  const hasChanges = useMemo(
    () => Boolean(company && normalizedName && normalizedName !== String(company.name || '').trim()),
    [company, normalizedName],
  );

  useEffect(() => {
    if (company?.name) setName(company.name);
  }, [company?.name]);

  function syncCompanyIntoSession(updatedCompany) {
    if (!user || !token || !updatedCompany?.id) return;

    const nextUser = {
      ...user,
      activeCompany: {
        ...(user.activeCompany || {}),
        ...updatedCompany,
      },
      activeMembership: user.activeMembership
        ? {
            ...user.activeMembership,
            company: {
              ...(user.activeMembership.company || {}),
              ...updatedCompany,
            },
          }
        : user.activeMembership,
      memberships: Array.isArray(user.memberships)
        ? user.memberships.map(membership =>
            membership.companyId === updatedCompany.id || membership.company?.id === updatedCompany.id
              ? {
                  ...membership,
                  company: {
                    ...(membership.company || {}),
                    ...updatedCompany,
                  },
                }
              : membership,
          )
        : user.memberships,
    };

    saveSession(token, nextUser);
    dispatch(setSession({ token, user: nextUser }));
    dispatch(baseApi.util.invalidateTags([
      { type: 'Me', id: 'CURRENT' },
      { type: 'WorkEntries', id: 'SUMMARY' },
      { type: 'WorkEntries', id: 'PAYROLL' },
    ]));
  }

  async function submitCompany(event) {
    event.preventDefault();
    setMessage('');
    setActionError('');
    if (!normalizedName) {
      setActionError(t('company.nameRequired'));
      return;
    }
    try {
      const result = await updateCompanySettings({ name: normalizedName }).unwrap();
      const updatedCompany = result?.company || null;
      if (updatedCompany) syncCompanyIntoSession(updatedCompany);
      setName(updatedCompany?.name || normalizedName);
      setMessage(t('company.savedMessage'));
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  return (
    <section className="companySettingsPage pageStack">
      <header className="companySettingsHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">{t('company.eyebrow')}</p>
          <h1>{t('company.title')}</h1>
          <p>{error ? t('company.loadError') : company?.name || t('company.current')}</p>
        </div>
      </header>

      <form className="companySettingsPanel screenCard" onSubmit={submitCompany}>
        <div className="compactHeader">
          <h2>{t('company.identity')}</h2>
          <p>{t('company.copy')}</p>
        </div>

        {isLoading ? <RequestLoadingState label={t('company.loading')} /> : null}
        {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

        {!isLoading && !error && company ? (
          <>
            <label className="companySettingsField">
              <span>{t('company.name')}</span>
              <input type="text" autoComplete="organization" maxLength={120} value={name} onChange={event => { setName(event.target.value); setMessage(''); setActionError(''); }} required />
            </label>

            <div className="companySettingsMetaCard">
              <div className="companySettingsMeta"><span>{t('company.slug')}</span><strong>{company.slug || '-'}</strong></div>
              <p>{t('company.slugCopy')}</p>
            </div>

            {message ? <p className="statusNote is-success">{message}</p> : null}
            {actionError ? <p className="statusNote is-error">{actionError}</p> : null}

            <button className="companySettingsButton" type="submit" disabled={updateState.isLoading || !hasChanges}>
              {updateState.isLoading ? t('company.saving') : hasChanges ? t('company.saveChanges') : t('company.saved')}
            </button>
          </>
        ) : null}
      </form>
    </section>
  );
}
