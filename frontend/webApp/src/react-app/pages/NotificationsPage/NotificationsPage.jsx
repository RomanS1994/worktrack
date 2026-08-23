import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../../features/worktrack/worktrackApi.js';
import './NotificationsPage.css';

const LOCALES = { uk: 'uk-UA', cs: 'cs-CZ', en: 'en-GB' };
const NOTIFICATION_COPY = {
  uk: {
    submittedTitle: name => `${name} відправив(ла) тиждень`,
    submittedMessage: period => period ? `Перевірте робочі години за ${period}.` : 'Тиждень готовий до перевірки.',
    approvedTitle: 'Тиждень погоджено',
    approvedMessage: period => `Ваші години за ${period} погоджено.`,
    rejectedTitle: 'Потрібні зміни в тижні',
    rejectedFallback: 'Менеджер відхилив цей тиждень. Відкрийте його, внесіть виправлення та відправте повторно.',
  },
  en: {
    submittedTitle: name => `${name} submitted a week`,
    submittedMessage: period => period ? `Review work hours for ${period}.` : 'A weekly submission is ready for review.',
    approvedTitle: 'Week approved',
    approvedMessage: period => `Your work for ${period} was approved.`,
    rejectedTitle: 'Week needs changes',
    rejectedFallback: 'Your manager rejected this week. Open it to make corrections and resubmit it.',
  },
  cs: {
    submittedTitle: name => `${name} odeslal(a) týden`,
    submittedMessage: period => period ? `Zkontrolujte pracovní hodiny za období ${period}.` : 'Týden je připraven ke kontrole.',
    approvedTitle: 'Týden byl schválen',
    approvedMessage: period => `Vaše práce za období ${period} byla schválena.`,
    rejectedTitle: 'Týden vyžaduje úpravy',
    rejectedFallback: 'Manažer tento týden zamítl. Otevřete ho, proveďte opravy a odešlete znovu.',
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

function localizeNotification(notification, language) {
  const copy = NOTIFICATION_COPY[language] || NOTIFICATION_COPY.en;
  const type = notification?.type || '';

  if (type === 'weekly_submission.submitted') {
    const suffix = ' submitted a week';
    const originalTitle = String(notification.title || '');
    const employeeName = originalTitle.endsWith(suffix)
      ? originalTitle.slice(0, -suffix.length)
      : originalTitle || (language === 'cs' ? 'Zaměstnanec' : language === 'uk' ? 'Працівник' : 'Employee');
    const period = extractPeriod(notification.message);
    return { title: copy.submittedTitle(employeeName), message: copy.submittedMessage(period) };
  }

  if (type === 'weekly_submission.approved') {
    const period = extractPeriod(notification.message);
    return { title: copy.approvedTitle, message: copy.approvedMessage(period || '—') };
  }

  if (type === 'weekly_submission.rejected') {
    const backendFallback = 'Your manager rejected this week. Open it to make corrections.';
    const message = notification.message && notification.message !== backendFallback
      ? notification.message
      : copy.rejectedFallback;
    return { title: copy.rejectedTitle, message };
  }

  return { title: notification.title, message: notification.message };
}

export function NotificationsPage() {
  const { language, t } = useI18n();
  const locale = LOCALES[language] || LOCALES.uk;
  const { data, error, isLoading } = useGetNotificationsQuery(undefined, { pollingInterval: 60000 });
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
  const unreadCount = Number(data?.unreadCount || 0);
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, markAllState] = useMarkAllNotificationsReadMutation();

  async function openNotification(notification) {
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
            const localized = localizeNotification(notification, language);
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
