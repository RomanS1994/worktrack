import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { RequestLoader } from '../../../../app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '../../../../app/i18n/useI18n.js';
import { useUpdateProfileMutation } from '../../authApi.js';
import { selectToken, selectUser, setSession } from '../../authSlice.js';
import { saveSession } from '../../authStorage.js';
import './AccountProfileForm.css';

export function AccountProfileForm() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const { t } = useI18n();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(user?.name || '');
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const updatedUser = await updateProfile({ name }).unwrap();
      saveSession(token, updatedUser);
      dispatch(setSession({ token, user: updatedUser }));
      setMessage(t('auth.profileSaved'));
    } catch {
      setError(t('auth.failedToSaveProfile'));
    }
  }

  return (
    <form className="accountProfileForm" onSubmit={handleSubmit}>
      <h3 className="accountProfileForm-title">{t('auth.accountProfileTitle')}</h3>

      <label className="accountProfileForm-field">
        <span>{t('auth.name')}</span>
        <input
          type="text"
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </label>

      {message ? <p className="accountProfileForm-message">{message}</p> : null}
      {error ? <p className="accountProfileForm-error">{error}</p> : null}

      <button className="accountProfileForm-button" type="submit" disabled={isLoading}>
        {isLoading ? <RequestLoader inline size="sm" label={t('auth.savingProfile')} /> : t('auth.saveProfile')}
      </button>
    </form>
  );
}
