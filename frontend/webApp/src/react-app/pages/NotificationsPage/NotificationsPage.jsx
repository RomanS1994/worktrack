import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../../features/worktrack/worktrackApi.js';
import './NotificationsPage.css';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function NotificationsPage() {
  const { data, error, isLoading } = useGetNotificationsQuery(undefined, {
    pollingInterval: 60000,
  });
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
  const unreadCount = Number(data?.unreadCount || 0);
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, markAllState] = useMarkAllNotificationsReadMutation();

  async function openNotification(notification) {
    if (!notification?.readAt) {
      try {
        await markRead(notification.id).unwrap();
      } catch {
        // Navigation should still work if marking read fails.
      }
    }
  }

  async function markEverythingRead() {
    try {
      await markAllRead().unwrap();
    } catch {
      // RTK Query exposes the mutation error below.
    }
  }

  const headerStatus = error
    ? 'Unable to load notifications'
    : unreadCount
      ? `${unreadCount} unread`
      : 'You are all caught up';

  return (
    <section className="notificationsPage pageStack">
      <header className="notificationsHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Inbox</p>
          <h1>Notifications</h1>
          <p>{headerStatus}</p>
        </div>
        <button
          className="notificationsMarkAll"
          type="button"
          disabled={Boolean(error) || !unreadCount || markAllState.isLoading}
          onClick={markEverythingRead}
        >
          Mark all read
        </button>
      </header>

      <section className="screenCard notificationsPanel">
        {isLoading ? <RequestLoadingState label="Loading notifications" /> : null}
        {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
        {markAllState.error ? (
          <p className="statusNote is-error">{getApiErrorMessage(markAllState.error)}</p>
        ) : null}

        {!isLoading && !error && !notifications.length ? (
          <div className="notificationsEmpty">
            <strong>No notifications yet</strong>
            <p>Updates about submitted and reviewed weeks will appear here.</p>
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
                  <time>{formatDateTime(notification.createdAt)}</time>
                </span>
              </>
            );

            return notification.href ? (
              <Link
                className={className}
                to={notification.href}
                key={notification.id}
                onClick={() => openNotification(notification)}
              >
                {content}
              </Link>
            ) : (
              <button
                className={className}
                type="button"
                key={notification.id}
                onClick={() => openNotification(notification)}
              >
                {content}
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
