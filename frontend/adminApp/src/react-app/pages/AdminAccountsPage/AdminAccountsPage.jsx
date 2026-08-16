import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { AdminUsersList } from '../../features/admin/components/AdminUsersList/AdminUsersList.jsx';
import { useGetAdminUsersQuery } from '@shared/features/admin/adminApi.js';
import './AdminAccountsPage.css';

export function AdminAccountsPage() {
  const { data, isLoading, isError, error } = useGetAdminUsersQuery();
  const { t } = useI18n();
  const navigate = useNavigate();
  const users = data?.users || [];
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter(user => {
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();

      return name.includes(query) || email.includes(query);
    });
  }, [search, users]);

  if (isLoading) {
    return (
      <section className="adminAccountsPage">
        <RequestLoadingState className="adminAccountsPage-state" label={t('common.loadingUsers')} />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="adminAccountsPage">
        <p className="adminAccountsPage-state">{getApiErrorMessage(error)}</p>
      </section>
    );
  }

  if (!users.length) {
    return (
      <section className="adminAccountsPage">
        <p className="adminAccountsPage-state">{t('common.noUsers')}</p>
      </section>
    );
  }

  return (
    <section className="adminAccountsPage">
      <div className="adminAccountsPage-header">
        <div className="adminAccountsPage-headerRow">
          <h2 className="adminAccountsPage-title">{t('adminAccounts.title')}</h2>
          <span className="adminAccountsPage-count">
            {filteredUsers.length}/{users.length}
          </span>
        </div>
        <p className="adminAccountsPage-copy">{t('adminAccounts.copy')}</p>
        <label className="adminAccountsPage-search">
          <span className="adminAccountsPage-searchLabel">{t('common.search')}</span>
          <input
            className="adminAccountsPage-searchInput"
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={t('adminAccounts.searchPlaceholder')}
            aria-label={t('adminAccounts.searchPlaceholder')}
          />
        </label>
      </div>

      {filteredUsers.length ? (
        <AdminUsersList
          users={filteredUsers}
          onOpenUser={userId => navigate(`/admin/accounts/${userId}`)}
        />
      ) : (
        <section className="adminAccountsPage-panel adminAccountsPage-panel--empty">
          <p className="adminAccountsPage-empty">{t('adminAccounts.emptySearch')}</p>
        </section>
      )}
    </section>
  );
}
