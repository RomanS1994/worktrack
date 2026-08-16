import { useSelector } from 'react-redux';

import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import './ProfilePage.css';

function getName(user) {
  return user?.name || user?.email || '-';
}

export function ProfilePage() {
  const user = useSelector(selectUser);
  const roleLabel = hasManagerAccess(user) ? 'MANAGER' : 'EMPLOYEE';

  return (
    <section className="profilePage pageStack">
      <header className="profileHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Profile</p>
          <h1>{getName(user)}</h1>
          <p>{roleLabel}</p>
        </div>
      </header>

      <section className="profileDetails screenCard">
        <div className="profileRow">
          <span>Email</span>
          <strong>{user?.email || '-'}</strong>
        </div>
        <div className="profileRow">
          <span>Role</span>
          <strong>{roleLabel}</strong>
        </div>
        <div className="profileRow">
          <span>Hourly rate</span>
          <strong>{user?.hourlyRateCzk ? `${user.hourlyRateCzk} CZK` : '0 CZK'}</strong>
        </div>
      </section>
    </section>
  );
}
