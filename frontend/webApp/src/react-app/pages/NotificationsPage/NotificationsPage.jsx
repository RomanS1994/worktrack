import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import { setCabinetMode } from '@shared/features/auth/cabinetMode.js';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../../features/worktrack/worktrackApi.js';
import './NotificationsPage.css';

const LOCALES = { uk: 'uk-UA', cs: 'cs-CZ', en: 'en-GB' };
const MANAGER_NOTIFICATION_TYPES = new Set([
  'weekly_submission.submitted',
  'invoice.sent',
  'invoice.cancelled',
]);
const EMPLOYEE_NOTIFICATION_TYPES = new Set([
  'weekly_submission.approved',
  'weekly_submission.rejected',
  'weekly_submission.reopened',
  'invoice.viewed',
  'invoice.paid',
]);
const INVOICE_COPY = {
  uk: {
    sentTitle: number => `Отримано фактуру ${number}`,
    sentMessage: message => `Нова фактура працівника: ${message}`,
    cancelledTitle: number => `Фактуру ${number} скасовано`,
    cancelledMessage: 'Працівник скасував цю фактуру.',
    viewedTitle: number => `Фактуру ${number} переглянуто`,
    viewedMessage: 'Роботодавець відкрив вашу фактуру.',
    paidTitle: number => `Фактуру ${number} оплачено`,
    paidMessage: message => `${message.replace(' was marked as paid.', '')} позначено як оплачено.`,
  },
  cs: {
    sentTitle: number => `Přijata faktura ${number}`,
    sentMessage: message => `Nová faktura pracovníka: ${message}`,
    cancelledTitle: number => `Faktura ${number} byla zrušena`,
    cancelledMessage: 'Pracovník tuto fakturu zrušil.',
    viewedTitle: number => `Faktura ${number} byla zobrazena`,
    viewedMessage: 'Zaměstnavatel otevřel vaši fakturu.',
    paidTitle: number => `Faktura ${number} byla zaplacena`,
    paidMessage: message => `${message.replace(' was marked as paid.', '')} bylo označeno jako zaplacené.`,
  },
  en: {
    sentTitle: number => `Invoice ${number} received`,
    sentMessage: message => message,
    cancelledTitle: number => `Invoice ${number} cancelled`,
    cancelledMessage: 'The employee cancelled this invoice.',
    viewedTitle: number => `Invoice ${number} viewed`,
    viewedMessage: 'Your employer opened the invoice.',
    paidTitle: number => `Invoice ${number} paid`,
    paidMessage: message => message,
  },
};

function formatDateTime(value, locale) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function extractPeriod(message = '') {
  const match = String(message).match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  return match ? `${match[1]} – ${match[2]}` : '';
}

function extractInvoiceNumber(notification) {
  const title = String(notification?.title || '');
  const match = title.match(/Invoice\s+([^\s]+)(?:\s|$)/i);
  return match?.[1] || '';
}

function cabinetForNotification(notification) {
  const type = String(notification?.type || '');
  const href = String(notification?.href || '');
  if (MANAGER_NOTIFICATION_TYPES.has(type)) return 'manager';
  if (EMPLOYEE_NOTIFICATION_TYPES.has(type)) return 'employee';
  if (href.startsWith('/manager/') || ['/approvals', '/employees', '/projects', '/company-settings'].includes(href)) return 'manager';
  if (href.startsWith('/invoices') || href.startsWith('/hours') || href === '/calendar' || href === '/tax-information') return 'employee';
  return '';
}

function localizeNotification(notification, t, language) {
  const type = notification?.type || '';

  if (type === 'weekly_submission.submitted') {
    const suffix = ' submitted a week';
    const originalTitle = String(notification.title || '');
    const employeeName = originalTitle.endsWith(suffix)
      ? originalTitle.slice(0, -suffix.length)
      : originalTitle || t('notificationDynamic.employeeFallback');
    const period = extractPeriod(notification.message);
    return {
      title: t('notificationDynamic.submittedTitle', { name: employeeName }),
      message: period
        ? t('notificationDynamic.submittedMessage', { period })
        : t('notificationDynamic.submittedFallback'),
    };
  }

  if (type === 'weekly_submission.approved') {
    const period = extractPeriod(notification.message) || '—';
    return {
      title: t('notificationDynamic.approvedTitle'),
      message: t('notificationDynamic.approvedMessage', { period }),
    };
  }

  if (type === 'weekly_submission.rejected') {
    const backendFallback = 'Your manager rejected this week. Open it to make corrections.';
    return {
      title: t('notificationDynamic.rejectedTitle'),
      message: notification.message && notification.message !== backendFallback
        ? notification.message
        : t('notificationDynamic.rejectedFallback'),
    };
  }

  if (type === 'weekly_submission.reopened') {
    const period = extractPeriod(notification.message);
    return {
      title: t('notificationDynamic.reopenedTitle'),
      message: period
        ? t('notificationDynamic.reopenedMessage', { period })
        : t('notificationDynamic.reopenedFallback'),
    };
  }

  if (type.startsWith('invoice.')) {
    const copy = INVOICE_COPY[language] || INVOICE_COPY.uk;
    const invoiceNumber = extractInvoiceNumber(notification) || '—';
    if (type === 'invoice.sent') return { title: copy.sentTitle(invoiceNumber), message: copy.sentMessage(notification.message || '') };
    if (type === 'invoice.cancelled') return { title: copy.cancelledTitle(invoiceNumber), message: copy.cancelledMessage };
    if (type === 'invoice.viewed') return { title: copy.viewedTitle(invoiceNumber), message: copy.viewedMessage };
    if (type === 'invoice.paid') return { title: copy.paidTitle(invoiceNumber), message: copy.paidMessage(notification.message || '') };
  }

  return { title: notification.title, message: notification.message };
}

export function NotificationsPage() {
  const { language, t } = useI18n();
  const user = useSelector(selectUser);
  const locale = LOCALES[language] || LOCALES.uk;
  const { data, error, isLoading } = useGetNotificationsQuery(undefined, { pollingInterval: 60000 });
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
  const unreadCount = Number(data?.unreadCount || 0);
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, markAllState] = useMarkAllNotificationsReadMutation();

  async function openNotification(notification) {
    const nextCabinet = cabinetForNotification(notification);
    if (nextCabinet === 'employee') setCabinetMode('employee', user);
    if (nextCabinet === 'manager' && hasManagerAccess(user)) setCabinetMode('manager', user);
    if (!notification?.readAt) {
      try { await markRead(notification.id).unwrap(); } catch { /* Navigation should still work. */ }
    }
  }

  async function markEverythingRead() {
    try { await markAllRead().unwrap(); } catch { /* Mutation error is rendered below. */ }
  }

  const headerStatus = error
    ? t('notifications.loadError')
    : unreadCount
      ? t('notifications.unread', { count: unreadCount })
      : t('notifications.caughtUp');

  return (
    <section className="notificationsPage pageStack">
      <header className="notificationsHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">{t('notifications.eyebrow')}</p>
          <h1>{t('notifications.title')}</h1>
          <p>{headerStatus}</p>
        </div>
        <button className="notificationsMarkAll" type="button" disabled={Boolean(error) || !unreadCount || markAllState.isLoading} onClick={markEverythingRead}>
          {t('notifications.markAll')}
        </button>
      </header>

      <section className="screenCard notificationsPanel">
        {isLoading ? <RequestLoadingState label={t('notifications.loading')} /> : null}
        {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
        {markAllState.error ? <p className="statusNote is-error">{getApiErrorMessage(markAllState.error)}</p> : null}

        {!isLoading && !error && !notifications.length ? (
          <div className="notificationsEmpty">
            <strong>{t('notifications.empty')}</strong>
            <p>{t('notifications.emptyCopy')}</p>
          </div>
        ) : null}

        <div className="notificationsList">
          {notifications.map(notification => {
            const className = `notificationItem${notification.readAt ? '' : ' is-unread'}`;
            const localized = localizeNotification(notification, t, language);
            const content = (
              <>
                <span className="notificationDot" aria-hidden="true" />
                <span className="notificationBody">
                  <strong>{localized.title}</strong>
                  <span>{localized.message}</span>
                  <time>{formatDateTime(notification.createdAt, locale)}</time>
                </span>
              </>
            );

            return notification.href ? (
              <Link className={className} to={notification.href} key={notification.id} onClick={() => openNotification(notification)}>{content}</Link>
            ) : (
              <button className={className} type="button" key={notification.id} onClick={() => openNotification(notification)}>{content}</button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
