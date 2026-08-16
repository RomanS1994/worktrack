import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { ContractForm } from '../../features/contract/components/ContractForm/ContractForm.jsx';
import { selectContract } from '../../features/contract/contractSlice.js';
import {
  clearSession,
  hasGenerationSession,
  selectGenerationSession,
  startSession,
} from '../../features/contract/generationSessionSlice.js';
import { useGenerationSessionPersistence } from '../../features/contract/useGenerationSessionPersistence.js';
import { GenerationGateModal } from '../../features/contract/components/GenerationGateModal/GenerationGateModal.jsx';
import { GenerationSessionBanner } from '../../features/contract/components/GenerationSessionBanner/GenerationSessionBanner.jsx';
import sessionRobot from '../../assets/main_robot.png';
import './OrdersPage.css';

function buildGenerationSessionPayload(contract) {
  return {
    accessGranted: true,
    orderId: '',
    orderNumber: '',
    documentType: String(contract?.documentType || 'confirmation'),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

export function OrdersPage() {
  const { t } = useI18n();
  const isGenerationReady = useGenerationSessionPersistence();

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const contract = useSelector(selectContract);
  const generationSession = useSelector(selectGenerationSession);
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [sessionError, setSessionError] = useState({
    type: '',
    message: '',
  });
  const hasActiveSession = hasGenerationSession(generationSession);
  const hasActiveSubscription = user?.subscription?.status === 'active';
  const hasDriverPhone = Boolean(user?.phone);

  useEffect(() => {
    if (!isGenerationReady) {
      return;
    }

    if (!hasActiveSubscription || !hasDriverPhone) {
      if (hasActiveSession) {
        dispatch(clearSession());
      }
      setIsGateOpen(false);
      return;
    }

    if (!hasActiveSession && !sessionError.message) {
      setIsGateOpen(true);
      return;
    }

    if (hasActiveSession) {
      setIsGateOpen(false);
    }
  }, [
    dispatch,
    hasActiveSession,
    hasActiveSubscription,
    hasDriverPhone,
    isGenerationReady,
    sessionError.message,
  ]);

  async function handleConfirmGate() {
    setIsReserving(true);
    dispatch(startSession(buildGenerationSessionPayload(contract)));
    setSessionError({ type: '', message: '' });
    setIsGateOpen(false);
    setIsReserving(false);
  }

  function handleCloseGate() {
    navigate('/', { replace: true });
  }

  function handleExpiredSession() {
    dispatch(clearSession());
    setSessionError({
      type: 'expired',
      message: t('contract.sessionExpired'),
    });
    setIsGateOpen(false);
  }

  function closeErrorModal() {
    setSessionError({ type: '', message: '' });
    navigate('/', { replace: true });
  }

  function openAccountUpgrade() {
    navigate('/settings/plan-upgrade');
  }

  function openBusinessProfile() {
    navigate('/settings/business-profile');
  }

  return (
    <section className="ordersPage pageStack">
      {!hasActiveSubscription ? (
        <div className="ordersPage-blocked">
          <p className="ordersPage-blockedEyebrow">{t('account.planExpiredEyebrow')}</p>
          <h2>{t('contract.planExpiredTitle')}</h2>
          <p>{t('contract.subscriptionInactive')}</p>
          <button className="ordersPage-blockedButton" type="button" onClick={openAccountUpgrade}>
            {t('contract.openAccountForUpgrade')}
          </button>
        </div>
      ) : !hasDriverPhone ? (
        <div className="ordersPage-blocked">
          <p className="ordersPage-blockedEyebrow">{t('settings.businessProfile.title')}</p>
          <h2>{t('auth.phoneTitle')}</h2>
          <p>{t('auth.phoneRequiredForOrders')}</p>
          <button className="ordersPage-blockedButton" type="button" onClick={openBusinessProfile}>
            {t('settings.businessProfile.title')}
          </button>
        </div>
      ) : hasActiveSession ? (
        <>
          <GenerationSessionBanner
            session={generationSession}
            onExpired={handleExpiredSession}
          />
          <ContractForm />
        </>
      ) : null}

      <GenerationGateModal
        isOpen={hasActiveSubscription && hasDriverPhone && isGateOpen && !hasActiveSession}
        isBusy={isReserving}
        onClose={handleCloseGate}
        onConfirm={handleConfirmGate}
      />

      {sessionError.message ? (
        <div
          className={`ordersPage-errorModal ${sessionError.type === 'expired' ? 'ordersPage-errorModal--expired' : ''}`}
          role="presentation"
        >
          <div className="ordersPage-errorBackdrop" />
          <div
            className="ordersPage-errorSheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ordersErrorTitle"
          >
            {sessionError.type === 'expired' ? (
              <>
                <div className="ordersPage-errorArt" aria-hidden="true">
                  <img src={sessionRobot} alt="" />
                </div>

                <div className="ordersPage-errorCopy">
                  <p className="ordersPage-errorEyebrow">{t('contract.orderWindow')}</p>
                  <h2 id="ordersErrorTitle">{t('contract.sessionExpired')}</h2>
                  <p>{sessionError.message}</p>
                </div>

                <button
                  className="ordersPage-errorButton"
                  type="button"
                  onClick={closeErrorModal}
                >
                  {t('app.home')}
                </button>
              </>
            ) : (
              <>
                <div className="ordersPage-errorCopy">
                  <p className="ordersPage-errorEyebrow">{t('contract.orderWindow')}</p>
                  <h2 id="ordersErrorTitle">{t('common.failed')}</h2>
                  <p>{sessionError.message}</p>
                </div>

                <button
                  className="ordersPage-errorButton"
                  type="button"
                  onClick={closeErrorModal}
                >
                  {t('common.backToHome')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
