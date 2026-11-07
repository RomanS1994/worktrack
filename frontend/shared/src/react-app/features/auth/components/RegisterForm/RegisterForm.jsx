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

export function RegisterForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [registerCompany, { isLoading }] = useRegisterCompanyMutation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [planCode, setPlanCode] = useState('TEAM_1_5');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('registerForm.mismatch'));
      return;
    }

    try {
      const data = await registerCompany({ firstName, lastName, email, password, companyName, planCode }).unwrap();
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
      <h3 className="registerForm-title">{t('registerForm.title')}</h3>

      <div className="registerForm-grid">
        <label className="registerForm-field"><span>{t('registerForm.firstName')}</span><input autoComplete="given-name" type="text" value={firstName} onChange={event => setFirstName(event.target.value)} /></label>
        <label className="registerForm-field"><span>{t('registerForm.lastName')}</span><input autoComplete="family-name" type="text" value={lastName} onChange={event => setLastName(event.target.value)} /></label>
      </div>

      <label className="registerForm-field"><span>{t('auth.email')}</span><input autoComplete="email" spellCheck={false} autoCapitalize="none" type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="registerForm-field"><span>{t('registerForm.companyName')}</span><input autoComplete="organization" type="text" value={companyName} onChange={event => setCompanyName(event.target.value)} /></label>

      <section className="registerTrial" aria-labelledby="registerTrial-title">
        <div className="registerTrial-banner"><span className="registerTrial-sparkle" aria-hidden="true">✦</span><div><strong>{t('registerForm.trialTitle')}</strong><p>{t('registerForm.trialCopy')}</p></div><span className="registerTrial-badge">{t('registerForm.trialBadge')}</span></div>
        <fieldset className="registerPlanFieldset">
          <legend>{t('registerForm.planTitle')}</legend>
          <p>{t('registerForm.planCopy')}</p>
          <div className="registerPlanGrid">
            {[
              { code: 'TEAM_1_5', seats: '1–5', price: '490' },
              { code: 'TEAM_6_10', seats: '6–10', price: '790' },
              { code: 'TEAM_11_20', seats: '11–20', price: '1 290' },
              { code: 'TEAM_21_40', seats: '21–40', price: '2 190' },
            ].map(plan => (
              <label className={`registerPlanOption${planCode === plan.code ? ' is-selected' : ''}`} key={plan.code}>
                <input type="radio" name="planCode" value={plan.code} checked={planCode === plan.code} onChange={() => setPlanCode(plan.code)} />
                <span className="registerPlanOptionMain"><strong>{plan.seats} {t('registerForm.employees')}</strong><small>{t('registerForm.afterTrial')}</small></span>
                <span className="registerPlanOptionPrice">{plan.price}<small> Kč / {t('registerForm.month')}</small></span>
              </label>
            ))}
          </div>
          <small className="registerTrial-footnote">{t('registerForm.trialTerms')}</small>
        </fieldset>
      </section>

      <PasswordField label={t('auth.password')} name="new-password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} showPasswordLabel={t('auth.showPassword')} hidePasswordLabel={t('auth.hidePassword')} />
      <PasswordField label={t('registerForm.confirmPassword')} name="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} showPasswordLabel={t('auth.showPassword')} hidePasswordLabel={t('auth.hidePassword')} />

      {error ? <p className="registerForm-error">{error}</p> : null}
      <button className="registerForm-button" type="submit" disabled={isLoading}>{isLoading ? <RequestLoader inline size="sm" label={t('registerForm.registering')} /> : t('registerForm.register')}</button>
    </form>
  );
}
