import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetAuditLogsQuery } from '@shared/features/admin/adminApi.js';
import './AdminAuditPanel.css';

export function AdminAuditPanel() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useGetAuditLogsQuery();
  const auditLogs = data?.audit || [];

  if (isLoading) {
    return (
      <section className="adminAuditPanel">
        <RequestLoadingState className="adminAuditPanel-state" label={t('admin.loadingAudit')} />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="adminAuditPanel">
        <p className="adminAuditPanel-state">{t('admin.failedAudit')}</p>
      </section>
    );
  }

  if (!auditLogs.length) {
    return (
      <section className="adminAuditPanel">
        <p className="adminAuditPanel-state">{t('admin.noAudit')}</p>
      </section>
    );
  }

  return (
    <section className="adminAuditPanel">
      <ul className="adminAuditPanel-list">
        {auditLogs.map(log => (
          <li className="adminAuditPanel-item" key={log.id}>
            <div className="adminAuditPanel-row">
              <span className="adminAuditPanel-label">{t('admin.action')}</span>
              <span className="adminAuditPanel-value">{log.action || '-'}</span>
            </div>
            <div className="adminAuditPanel-row">
              <span className="adminAuditPanel-label">{t('admin.actorUserId')}</span>
              <span className="adminAuditPanel-value">{log.actorUserId || '-'}</span>
            </div>
            <div className="adminAuditPanel-row">
              <span className="adminAuditPanel-label">{t('admin.targetUserId')}</span>
              <span className="adminAuditPanel-value">{log.targetUserId || '-'}</span>
            </div>
            <div className="adminAuditPanel-row">
              <span className="adminAuditPanel-label">{t('admin.entityType')}</span>
              <span className="adminAuditPanel-value">{log.entityType || '-'}</span>
            </div>
            <div className="adminAuditPanel-row">
              <span className="adminAuditPanel-label">{t('admin.entityId')}</span>
              <span className="adminAuditPanel-value">{log.entityId || '-'}</span>
            </div>
            <div className="adminAuditPanel-row">
              <span className="adminAuditPanel-label">{t('common.created')}</span>
              <span className="adminAuditPanel-value">{log.createdAt || '-'}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
