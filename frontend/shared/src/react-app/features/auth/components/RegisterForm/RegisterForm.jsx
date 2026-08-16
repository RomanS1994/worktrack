import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { RequestLoader } from '../../../../app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '../../../../app/i18n/useI18n.js';
import { getApiErrorMessage } from '../../../../app/api/getApiErrorMessage.js';
import { useRegisterMutation } from '../../authApi.js';
import { setSession } from '../../authSlice.js';
import { saveSession } from '../../authStorage.js';
import { PasswordField } from '../PasswordField/PasswordField.jsx';
import { useGetPlansQuery } from '@shared/features/plans/plansApi.js';
import './RegisterForm.css';

export function RegisterForm({ selectedPlanId = '', onPlanSelect }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [register, { isLoading }] = useRegisterMutation();
  const { data, isLoading: isPlansLoading } = useGetPlansQuery();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [planId, setPlanId] = useState('');
  const [error, setError] = useState('');
  const plans = data?.plans || [];
  const activePlanId = selectedPlanId || planId;

  useEffect(() => {
    // Ставимо перший доступний план за замовчуванням.
    if (!activePlanId && plans.length) {
      const nextPlanId = plans[0].id || '';
      setPlanId(nextPlanId);
      onPlanSelect?.(nextPlanId);
    }
  }, [activePlanId, onPlanSelect, plans]);

  useEffect(() => {
    if (selectedPlanId) {
      setPlanId(selectedPlanId);
    }
  }, [selectedPlanId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      // Передаємо вибраний план у запит реєстрації.
      const nextPlanId = activePlanId || plans[0]?.id || 'plan-free';
      const data = await register({
        name,
        email,
        password,
        planId: nextPlanId,
      }).unwrap();
      saveSession(data.token, data.user, {
        accessTokenExpiresAt: data.accessTokenExpiresAt || '',
        lastVerifiedAt: new Date().toISOString(),
      });
      dispatch(setSession({ token: data.token, user: data.user }));
      navigate('/', { replace: true });
    } catch (error) {
      setError(getApiErrorMessage(error, 'auth.registerFailed'));
    }
  }

  return (
    <form className="registerForm" onSubmit={handleSubmit}>
      <h3 className="registerForm-title">{t('auth.registerTitle')}</h3>

      <label className="registerForm-field">
        <span>{t('auth.name')}</span>
        <input type="text" value={name} onChange={event => setName(event.target.value)} />
      </label>

      <label className="registerForm-field">
        <span>{t('auth.email')}</span>
        <input
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
      </label>

      <PasswordField
        label={t('auth.password')}
        name="new-password"
        autoComplete="new-password"
        value={password}
        onChange={event => setPassword(event.target.value)}
        showPasswordLabel={t('auth.showPassword')}
        hidePasswordLabel={t('auth.hidePassword')}
      />

      <label className="registerForm-field">
        <span>{t('auth.plan')}</span>
        <select
          value={activePlanId}
          onChange={event => {
            const nextPlanId = event.target.value;
            setPlanId(nextPlanId);
            onPlanSelect?.(nextPlanId);
          }}
          disabled={isPlansLoading || !plans.length}
        >
          {plans.map(plan => (
            <option key={plan.id} value={plan.id}>
              {plan.name || plan.id}
            </option>
          ))}
        </select>
      </label>
      {isPlansLoading ? <RequestLoader inline size="sm" label={t('common.loadingPlans')} /> : null}

      {error ? <p className="registerForm-error">{error}</p> : null}

      <button className="registerForm-button" type="submit" disabled={isLoading}>
        {isLoading ? <RequestLoader inline size="sm" label={t('auth.registering')} /> : t('auth.register')}
      </button>
    </form>
  );
}
