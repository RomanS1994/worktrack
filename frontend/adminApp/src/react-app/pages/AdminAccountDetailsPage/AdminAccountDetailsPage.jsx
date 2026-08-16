import { useParams } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useGetAdminUserQuery } from '@shared/features/admin/adminApi.js';
import { formatDateTime } from '@shared/app/utils/dateFormat.js';
import { AdminUserDetails } from '../../features/admin/components/AdminUserDetails/AdminUserDetails.jsx';
import './AdminAccountDetailsPage.css';

function getInitials(user) {
  const source = user?.name || user?.email || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function AdminAccountDetailsPage() {
  const { t } = useI18n();
  const { userId } = useParams();
  const { data, isLoading, isError } = useGetAdminUserQuery(userId, {
    skip: !userId,
  });
  const user = data?.user || data || {};
  const createdAt = formatDateTime(user.createdAt, 'uk');
  const usedTokens = user.usage?.used ?? 0;

  if (isLoading) {
    return (
      <section className="adminAccountDetailsPage">
        <RequestLoadingState className="adminAccountDetailsPage-state" label={t('admin.loadingUser')} />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="adminAccountDetailsPage">
        <p className="adminAccountDetailsPage-state">{t('admin.failedUser')}</p>
      </section>
    );
  }

  return (
    <section className="adminAccountDetailsPage">
      <div className="adminAccountDetailsPage-header">
        <div className="adminAccountDetailsPage-backRow">
          <BackButton to="/admin/accounts" />
        </div>
        <div className="adminAccountDetailsPage-heading">
          <div className="adminAccountDetailsPage-identity">
            <span className="adminAccountDetailsPage-avatar" aria-hidden="true">
              {getInitials(user)}
            </span>
            <div className="adminAccountDetailsPage-headingText">
              <h2 className="adminAccountDetailsPage-title">{user.name || t('admin.userDetails')}</h2>
              <p className="adminAccountDetailsPage-copy">
                {user.email || t('common.unknownUser')}
              </p>
            </div>
          </div>
            <div className="adminAccountDetailsPage-summary">
              <div className="adminAccountDetailsPage-chip">
                <span className="adminAccountDetailsPage-chipLabel">{t('common.role')}</span>
                <strong className="adminAccountDetailsPage-chipValue">{user.role || '-'}</strong>
              </div>
              <div className="adminAccountDetailsPage-chip">
                <span className="adminAccountDetailsPage-chipLabel">{t('account.usedTokens')}</span>
                <strong className="adminAccountDetailsPage-chipValue">{usedTokens}</strong>
              </div>
            <div className="adminAccountDetailsPage-chip">
              <span className="adminAccountDetailsPage-chipLabel">{t('admin.subscription')}</span>
              <strong className="adminAccountDetailsPage-chipValue">
                {user.subscription?.status || '-'}
              </strong>
            </div>
            <div className="adminAccountDetailsPage-chip">
              <span className="adminAccountDetailsPage-chipLabel">{t('common.plan')}</span>
              <strong className="adminAccountDetailsPage-chipValue">{user.plan?.name || '-'}</strong>
            </div>
              <div className="adminAccountDetailsPage-chip">
                <span className="adminAccountDetailsPage-chipLabel">{t('common.created')}</span>
              <strong className="adminAccountDetailsPage-chipValue">{createdAt}</strong>
              </div>
            </div>
          </div>
      </div>

      <AdminUserDetails userId={userId} user={user} showSummary={false} showMeta={false} />
    </section>
  );
}
