import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useI18n } from '../../i18n/useI18n.js';
import {
  clearSessionError,
  selectSessionError,
  selectSessionErrorType,
} from '../../../features/auth/authSlice.js';
import './SessionNotice.css';

export function SessionNotice() {
  const dispatch = useDispatch();
  const { t } = useI18n();
  const sessionError = useSelector(selectSessionError);
  const sessionErrorType = useSelector(selectSessionErrorType);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!['offline', 'server'].includes(sessionErrorType) || !sessionError) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);

    const timer = window.setTimeout(() => {
      setVisible(false);
      dispatch(clearSessionError());
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [dispatch, sessionError, sessionErrorType]);

  if (!visible) {
    return null;
  }

  return (
    <div className="sessionNotice" role="status" aria-live="polite">
      <strong className="sessionNotice-title">{t('common.failed')}</strong>
      <p className="sessionNotice-text">{sessionError}</p>
    </div>
  );
}
