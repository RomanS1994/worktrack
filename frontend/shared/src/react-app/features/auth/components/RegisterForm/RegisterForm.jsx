import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { baseApi } from '../../../../app/api/baseApi.js';
import { getApiErrorMessage } from '../../../../app/api/getApiErrorMessage.js';
import { RequestLoader } from '../../../../app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '../../../../app/i18n/useI18n.js';
import { useRegisterCompanyMutation } from '../../authApi.js';
import { setSession } from '../../authSlice.js';
import { saveSession } from '../../authStorage.js';
import { PasswordField } from '../PasswordField/PasswordField.jsx';
import './RegisterForm.css';

const COPY = {
  uk: { title:'Створення компанії', firstName:'Ім’я', lastName:'Прізвище', companyName:'Назва компанії', confirmPassword:'Підтвердіть пароль', mismatch:'Паролі не збігаються.', register:'Зареєструвати компанію', registering:'Реєстрація…' },
  cs: { title:'Vytvoření firmy', firstName:'Jméno', lastName:'Příjmení', companyName:'Název firmy', confirmPassword:'Potvrďte heslo', mismatch:'Hesla se neshodují.', register:'Zaregistrovat firmu', registering:'Registrace…' },
  en: { title:'Create company', firstName:'First name', lastName:'Last name', companyName:'Company name', confirmPassword:'Confirm password', mismatch:'Passwords do not match.', register:'Register company', registering:'Registering…' },
};

export function RegisterForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const c = COPY[language] || COPY.uk;
  const [registerCompany, { isLoading }] = useRegisterCompanyMutation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(c.mismatch);
      return;
    }

    try {
      const data = await registerCompany({ firstName, lastName, email, password, companyName }).unwrap();
      dispatch(baseApi.util.resetApiState());
      saveSession(data.token, data.user, {
        accessTokenExpiresAt: data.accessTokenExpiresAt || '',
        lastVerifiedAt: new Date().toISOString(),
      });
      dispatch(setSession({ token: data.token, user: data.user }));
      navigate('/dashboard', { replace: true });
    } catch (mutationError) {
      setError(getApiErrorMessage(mutationError, 'auth.registerFailed'));
    }
  }

  return (
    <form className="registerForm" onSubmit={handleSubmit}>
      <h3 className="registerForm-title">{c.title}</h3>

      <div className="registerForm-grid">
        <label className="registerForm-field"><span>{c.firstName}</span><input autoComplete="given-name" type="text" value={firstName} onChange={event => setFirstName(event.target.value)} /></label>
        <label className="registerForm-field"><span>{c.lastName}</span><input autoComplete="family-name" type="text" value={lastName} onChange={event => setLastName(event.target.value)} /></label>
      </div>

      <label className="registerForm-field"><span>{t('auth.email')}</span><input autoComplete="email" spellCheck={false} autoCapitalize="none" type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="registerForm-field"><span>{c.companyName}</span><input autoComplete="organization" type="text" value={companyName} onChange={event => setCompanyName(event.target.value)} /></label>

      <PasswordField label={t('auth.password')} name="new-password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} showPasswordLabel={t('auth.showPassword')} hidePasswordLabel={t('auth.hidePassword')} />
      <PasswordField label={c.confirmPassword} name="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} showPasswordLabel={t('auth.showPassword')} hidePasswordLabel={t('auth.hidePassword')} />

      {error ? <p className="registerForm-error">{error}</p> : null}
      <button className="registerForm-button" type="submit" disabled={isLoading}>{isLoading ? <RequestLoader inline size="sm" label={c.registering} /> : c.register}</button>
    </form>
  );
}
