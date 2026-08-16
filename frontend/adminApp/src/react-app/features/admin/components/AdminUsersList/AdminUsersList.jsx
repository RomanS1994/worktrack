import { useState } from 'react';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import './AdminUsersList.css';

function getAvatarUrl(user) {
  return user?.profile?.avatarUrl || user?.profile?.avatar || user?.avatarUrl || '';
}

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

function AdminUserAvatar({ user }) {
  const [hasError, setHasError] = useState(false);
  const initials = getInitials(user);
  const avatarUrl = getAvatarUrl(user);

  if (hasError || !avatarUrl) {
    return <span className="adminUsersList-avatarFallback">{initials}</span>;
  }

  return (
    <img
      className="adminUsersList-avatarImage"
      src={avatarUrl}
      alt=""
      onError={() => setHasError(true)}
    />
  );
}

export function AdminUsersList({ users, activeUserId = '', onOpenUser }) {
  const { t } = useI18n();
  return (
    <ul className="adminUsersList">
      {users.map(user => (
        <li className="adminUsersList-item" key={user.id}>
          <button
            className={`adminUsersList-button ${activeUserId === user.id ? 'is-active' : ''}`}
            type="button"
            onClick={() => onOpenUser(user.id)}
          >
            <div className="adminUsersList-topRow">
              <span className="adminUsersList-nameWrap">
                <span className="adminUsersList-avatar" aria-hidden="true">
                  <AdminUserAvatar user={user} />
                </span>
                <span className="adminUsersList-name">{user.name || t('common.unknownUser')}</span>
              </span>
              <span className={`adminUsersList-role adminUsersList-role--${user.role || 'unknown'}`}>
                {user.role || '-'}
              </span>
            </div>
            <span className="adminUsersList-email">{user.email || '-'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
