import { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (company?.name) {
      setName(company.name);
    }
  }, [company?.name]);

  async function submitCompany(event) {
    event.preventDefault();
    setMessage('');
    setActionError('');

    try {
      await updateCompanySettings({ name }).unwrap();
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
          <h2>Company profile</h2>
          <p>Company-level billing and subscription settings will live here later.</p>
        </div>

        {isLoading ? <RequestLoadingState label="Loading company" /> : null}
        {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

        <label className="companySettingsField">
          <span>Company name</span>
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
          />
        </label>

        <div className="companySettingsMeta">
          <span>Slug</span>
          <strong>{company?.slug || '-'}</strong>
        </div>

        {message ? <p className="statusNote">{message}</p> : null}
        {actionError ? <p className="statusNote is-error">{actionError}</p> : null}

        <button
          className="companySettingsButton"
          type="submit"
          disabled={updateState.isLoading}
        >
          Save company
        </button>
      </form>
    </section>
  );
}
