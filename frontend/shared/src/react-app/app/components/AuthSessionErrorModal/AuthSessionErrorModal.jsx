import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import {
  clearSessionError,
  selectSessionError,
  selectSessionErrorType,
} from '../../../features/auth/authSlice.js';
import { useI18n } from '../../i18n/useI18n.js';
import './AuthSessionErrorModal.css';

export function AuthSessionErrorModal() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const sessionError = useSelector(selectSessionError);
  const sessionErrorType = useSelector(selectSessionErrorType);

  if (!sessionError || sessionErrorType !== 'expired') {
    return null;
  }

  function handleClose() {
    dispatch(clearSessionError());
    navigate('/sign-in', { replace: true });
  }

  return (
    <div className="authSessionErrorModal" role="presentation">
      <div className="authSessionErrorModal-backdrop" />
      <div
        className="authSessionErrorModal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="authSessionErrorTitle"
      >
        <div className="authSessionErrorModal-copy">
          <p className="authSessionErrorModal-eyebrow">{t('auth.sessionState')}</p>
          <h2 id="authSessionErrorTitle">{t('auth.sessionExpired')}</h2>
          <p>{sessionError}</p>
        </div>

        <button
          className="authSessionErrorModal-button"
          type="button"
          onClick={handleClose}
        >
          {t('auth.goToSignIn')}
        </button>
      </div>
    </div>
  );
}
