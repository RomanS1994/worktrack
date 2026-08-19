import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getLocale, getWorktrackMessage } from '@shared/app/i18n/worktrackMessages.js';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../../features/worktrack/worktrackApi.js';
import './NotificationsPage.css';

function formatDateTime(value, locale) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function NotificationsPage() {
  const { language } = useI18n();
  const t = (key, values) => getWorktrackMessage(language, key, values);
  const locale = getLocale(language);
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
            const content = (
              <>
                <span className="notificationDot" aria-hidden="true" />
                <span className="notificationBody">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
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
