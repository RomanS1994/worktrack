import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getApiErrorMessage } from '../../../../app/api/getApiErrorMessage.js';
import { useI18n } from '../../../../app/i18n/useI18n.js';
import { useUpdateProfileMutation } from '../../authApi.js';
import { selectToken, selectUser, setSession } from '../../authSlice.js';
import { saveSession } from '../../authStorage.js';

function getBusinessProfile(user) {
  const profile = user?.profile || {};

  return {
    driver: profile.driver || user?.driver || {},
  };
}

function buildInitialFormState(user) {
  const { driver } = getBusinessProfile(user);

  return {
    driverName: driver.name || '',
    driverAddress: driver.address || '',
    driverSpz: driver.spz || '',
    driverIco: driver.ico || '',
  };
}

export function useBusinessProfileForm() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const { t } = useI18n();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [form, setForm] = useState(() => buildInitialFormState(user));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(buildInitialFormState(user));
  }, [user]);

  function updateField(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const updatedUser = await updateProfile({
        driver: {
          name: form.driverName,
          address: form.driverAddress,
          spz: form.driverSpz,
          ico: form.driverIco,
        },
      }).unwrap();

      saveSession(token, updatedUser);
      dispatch(setSession({ token, user: updatedUser }));
      setMessage(t('auth.profileSaved'));
    } catch (error) {
      setError(getApiErrorMessage(error, 'auth.failedToSaveProfile'));
    }
  }

  return {
    error,
    form,
    handleSubmit,
    isLoading,
    message,
    t,
    updateField,
  };
}
