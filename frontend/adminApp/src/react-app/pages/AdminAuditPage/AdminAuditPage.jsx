import { useI18n } from '@shared/app/i18n/useI18n.js';
import { AdminAuditPanel } from '../../features/admin/components/AdminAuditPanel/AdminAuditPanel.jsx';
import './AdminAuditPage.css';

export function AdminAuditPage() {
  const { t } = useI18n();
  return (
    <section className="adminAuditPage">
      <div className="adminAuditPage-header">
        <h2 className="adminAuditPage-title">{t('adminAudit.title')}</h2>
        <p className="adminAuditPage-copy">{t('adminAudit.copy')}</p>
      </div>

      <AdminAuditPanel />
    </section>
  );
}
