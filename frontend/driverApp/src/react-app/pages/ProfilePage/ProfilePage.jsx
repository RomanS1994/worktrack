import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import {
  useChangePasswordMutation,
  useUpdateProfileMutation,
} from '@shared/features/auth/authApi.js';
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

  const [updateProfile, profileState] = useUpdateProfileMutation();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [changePassword, changeState] = useChangePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setPhone(user?.phone || '');
  }, [user?.firstName, user?.lastName, user?.phone]);

  function applyUpdatedUser(updatedUser) {
    saveSession(token, updatedUser);
    dispatch(setSession({ token, user: updatedUser }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    if (!normalizedFirstName) {
      setProfileError('First name is required');
      return;
    }

    try {
      const updatedUser = await updateProfile({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        name: [normalizedFirstName, normalizedLastName].filter(Boolean).join(' '),
        phone: phone.trim(),
      }).unwrap();

      applyUpdatedUser(updatedUser);
      setProfileSuccess('Profile updated successfully');
    } catch (error) {
      setProfileError(getApiErrorMessage(error));
    }
  }

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

      applyUpdatedUser(updatedUser);
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

      <form className="profileEditCard screenCard" onSubmit={handleProfileSubmit}>
        <div className="compactHeader">
          <h2>Personal details</h2>
          <p>Keep your contact information up to date.</p>
        </div>

        <div className="profileFieldGrid">
          <label className="profileField">
            <span>First name</span>
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={event => setFirstName(event.target.value)}
              required
            />
          </label>

          <label className="profileField">
            <span>Last name</span>
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={event => setLastName(event.target.value)}
            />
          </label>
        </div>

        <label className="profileField">
          <span>Phone</span>
          <input
            type="tel"
            autoComplete="tel"
            placeholder="+420 777 123 456"
            value={phone}
            onChange={event => setPhone(event.target.value)}
          />
        </label>

        {profileError ? <p className="statusNote is-error">{profileError}</p> : null}
        {profileSuccess ? <p className="statusNote is-success">{profileSuccess}</p> : null}

        <button className="profilePrimaryButton" type="submit" disabled={profileState.isLoading}>
          {profileState.isLoading ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <form className="profilePasswordCard screenCard" onSubmit={handlePasswordSubmit}>
        <div className="compactHeader">
          <h2>Change password</h2>
          <p>Use at least 8 characters.</p>
        </div>

        <label className="profileField">
          <span>Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={event => setCurrentPassword(event.target.value)}
            required
          />
        </label>

        <label className="profileField">
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

        <label className="profileField">
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

        <button className="profilePrimaryButton" type="submit" disabled={changeState.isLoading}>
          {changeState.isLoading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  );
}
