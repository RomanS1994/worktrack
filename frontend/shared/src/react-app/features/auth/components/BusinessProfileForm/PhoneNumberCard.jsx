import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getApiErrorMessage } from '../../../../app/api/getApiErrorMessage.js';
import { RequestLoader } from '../../../../app/components/RequestLoader/RequestLoader.jsx';
import { useUpdateProfileMutation } from '../../authApi.js';
import { saveSession } from '../../authStorage.js';
import { selectToken, selectUser, setSession } from '../../authSlice.js';

export function PhoneNumberCard({ t }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPhone(user?.phone || '');
  }, [user?.phone]);

  async function handleSavePhone() {
    setMessage('');
    setError('');

    try {
      const updatedUser = await updateProfile({ phone }).unwrap();
      saveSession(token, updatedUser);
      dispatch(setSession({ token, user: updatedUser }));
      setMessage(t('auth.phoneSaved'));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'auth.failedToSavePhone'));
    }
  }

  return (
    <section className="businessProfileForm-card businessProfileForm-card--phone">
      <div className="businessProfileForm-phoneHeader">
        <h3 className="businessProfileForm-subtitle">{t('auth.phoneTitle')}</h3>
      </div>

      <p className="businessProfileForm-phoneCopy">{t('auth.phoneCopy')}</p>

      <label className="businessProfileForm-field">
        <span>{t('auth.phoneLabel')}</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={event => {
            setPhone(event.target.value);
            setMessage('');
            setError('');
          }}
          placeholder={t('auth.phonePlaceholder')}
        />
      </label>

      <div className="businessProfileForm-phoneActions">
        <button
          className="businessProfileForm-secondaryButton businessProfileForm-secondaryButton--accent"
          type="button"
          onClick={handleSavePhone}
          disabled={isLoading}
        >
          {isLoading ? <RequestLoader inline size="sm" label={t('common.saving')} /> : t('auth.savePhone')}
        </button>
      </div>

      {message ? <p className="businessProfileForm-message">{message}</p> : null}
      {error ? <p className="businessProfileForm-error">{error}</p> : null}
    </section>
  );
}
