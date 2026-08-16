import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getGenerationWindowMs } from '../../generationSessionSlice.js';
import './GenerationSessionBanner.css';

function formatCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getRemainingMs(expiresAt) {
  const expiresTime = Date.parse(expiresAt || '');
  if (!Number.isFinite(expiresTime)) {
    return 0;
  }

  return Math.max(0, expiresTime - Date.now());
}

export function GenerationSessionBanner({ session, onExpired }) {
  const { t } = useI18n();
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(session?.expiresAt));

  useEffect(() => {
    setRemainingMs(getRemainingMs(session?.expiresAt));
  }, [session?.expiresAt]);

  useEffect(() => {
    if (!session?.expiresAt) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      const nextRemaining = getRemainingMs(session.expiresAt);
      setRemainingMs(nextRemaining);

      if (nextRemaining <= 0) {
        window.clearInterval(timerId);
        onExpired();
      }
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [onExpired, session?.expiresAt]);

  const progress = useMemo(() => {
    const windowMs = getGenerationWindowMs();
    if (!windowMs) {
      return 0;
    }

    return Math.max(0, Math.min(1, remainingMs / windowMs));
  }, [remainingMs]);

  return (
    <section className="generationSessionBanner">
      <div className="generationSessionBannerCopy">
        <p className="sectionEyebrow">{t('contract.orderWindow')}</p>
        <h2>{session?.orderId ? t('contract.orderReserved') : t('contract.tokenSessionActive')}</h2>
        <p>
          {session?.orderId
            ? t('contract.finishOrder')
            : t('contract.fillOrderDetails')}
        </p>
      </div>

      <div
        className="generationSessionTimer"
        aria-hidden="true"
        style={{ '--countdown-progress': `${progress * 100}%` }}
      >
        <div className="generationSessionCountdownValue">
          {formatCountdown(remainingMs)}
        </div>
      </div>
    </section>
  );
}
