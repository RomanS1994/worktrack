import { useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
} from '../../features/worktrack/worktrackApi.js';
import './CompanySettingsPage.css';

export function CompanySettingsPage() {
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
    if (company?.name) {
      setName(company.name);
    }
  }, [company?.name]);

  async function submitCompany(event) {
    event.preventDefault();
    setMessage('');
    setActionError('');

    if (!normalizedName) {
      setActionError('Company name is required.');
      return;
    }

    try {
      await updateCompanySettings({ name: normalizedName }).unwrap();
      setName(normalizedName);
      setMessage('Company name saved.');
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  return (
    <section className="companySettingsPage pageStack">
      <header className="companySettingsHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Company</p>
          <h1>Settings</h1>
          <p>{company?.name || 'Current company'}</p>
        </div>
      </header>

      <form className="companySettingsPanel screenCard" onSubmit={submitCompany}>
        <div className="compactHeader">
          <h2>Workspace identity</h2>
          <p>This name is shown to managers and employees across WorkTrack.</p>
        </div>

        {isLoading ? <RequestLoadingState label="Loading company" /> : null}
        {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

        <label className="companySettingsField">
          <span>Company name</span>
          <input
            type="text"
            autoComplete="organization"
            maxLength={120}
            value={name}
            onChange={event => {
              setName(event.target.value);
              setMessage('');
              setActionError('');
            }}
            required
          />
        </label>

        <div className="companySettingsMetaCard">
          <div className="companySettingsMeta">
            <span>Workspace slug</span>
            <strong>{company?.slug || '-'}</strong>
          </div>
          <p>The workspace slug is a stable internal identifier and is not changed when you rename the company.</p>
        </div>

        {message ? <p className="statusNote is-success">{message}</p> : null}
        {actionError ? <p className="statusNote is-error">{actionError}</p> : null}

        <button
          className="companySettingsButton"
          type="submit"
          disabled={isLoading || updateState.isLoading || !hasChanges}
        >
          {updateState.isLoading ? 'Saving…' : hasChanges ? 'Save changes' : 'Saved'}
        </button>
      </form>
    </section>
  );
}
