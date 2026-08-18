import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import { useChangePasswordMutation } from '@shared/features/auth/authApi.js';
import { selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import './ProfilePage.css';

function getName(user) {
  return user?.name || user?.email || '-';
}

export function ProfilePage() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const roleLabel = hasManagerAccess(user) ? 'MANAGER' : 'EMPLOYEE';
  const rate = user?.activeMembership?.hourlyRateCzk || user?.hourlyRateCzk || '';
  const [changePassword, changeState] = useChangePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    try {
      const updatedUser = await changePassword({
        currentPassword,
        newPassword,
      }).unwrap();

      saveSession(token, updatedUser);
      dispatch(setSession({ token, user: updatedUser }));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password updated successfully');
    } catch (error) {
      setPasswordError(getApiErrorMessage(error));
    }
  }

  return (
    <section className="profilePage pageStack">
      <header className="profileHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Profile</p>
          <h1>{getName(user)}</h1>
          <p>{user?.activeCompany?.name || roleLabel}</p>
        </div>
      </header>

      {user?.mustChangePassword ? (
        <section className="profilePasswordNotice screenCard" role="status">
          <strong>Change your temporary password</strong>
          <p>Your manager created this account with a temporary password. Set your own password now.</p>
        </section>
      ) : null}

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
          <span>Company</span>
          <strong>{user?.activeCompany?.name || '-'}</strong>
        </div>
        <div className="profileRow">
          <span>Hourly rate</span>
          <strong>{rate ? `${rate} CZK` : '-'}</strong>
        </div>
      </section>

      <form className="profilePasswordCard screenCard" onSubmit={handlePasswordSubmit}>
        <div className="compactHeader">
          <h2>Change password</h2>
          <p>Use at least 8 characters.</p>
        </div>

        <label className="profilePasswordField">
          <span>Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={event => setCurrentPassword(event.target.value)}
            required
          />
        </label>

        <label className="profilePasswordField">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            required
          />
        </label>

        <label className="profilePasswordField">
          <span>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            required
          />
        </label>

        {passwordError ? <p className="statusNote is-error">{passwordError}</p> : null}
        {passwordSuccess ? <p className="statusNote is-success">{passwordSuccess}</p> : null}

        <button className="profilePasswordButton" type="submit" disabled={changeState.isLoading}>
          {changeState.isLoading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  );
}
