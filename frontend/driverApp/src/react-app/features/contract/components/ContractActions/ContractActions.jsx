import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { RequestLoader } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGenerateContractPdfMutation } from '../../contractApi.js';
import { resetContract, selectContract } from '../../contractSlice.js';
import {
  clearSession,
  getGenerationWindowMs,
  isSessionExpired,
  selectGenerationSession,
  startSession,
} from '../../generationSessionSlice.js';
import { validateContract } from '../../utils/contractValidation.js';
import { downloadFile } from '../../utils/downloadFile.js';
import {
  useCreateOrderMutation,
  useUpdateOrderMutation,
} from '../../../orders/ordersApi.js';
import { resolveErrorMessage } from '@shared/app/utils/errorMessages.js';
import './ContractActions.css';

function getSourcePage() {
  return '/';
}

function buildValidationState() {
  return {
    customerName: '',
    customerContact: '',
    passengers: '',
    fromAddress: '',
    toAddress: '',
    tripDate: '',
    paymentMethod: '',
    totalPrice: '',
  };
}

function buildContractPayload(contract) {
  const passengersValue = String(contract?.passengers || '').trim();
  const passengersCount = Number.parseInt(passengersValue, 10);
  const safePassengers = Number.isFinite(passengersCount) && passengersCount > 0 ? passengersCount : 1;
  const totalPrice = String(contract?.totalPrice || '').trim() || String(safePassengers * 100);

  return {
    ...contract,
    totalPrice,
  };
}

function getSubscriptionErrorMessage(error, t) {
  const message = resolveErrorMessage(error, '');

  if (message === 'Subscription is not active') {
    return t('contract.subscriptionInactive');
  }

  if (message === 'Subscription limit reached') {
    return t('contract.subscriptionLimitReached');
  }

  return resolveErrorMessage(error, t('contract.failedCreateOrder'));
}

// Визначає, чи потрібно замість inline-помилки показати модалку оновлення плану.
function getSubscriptionErrorState(error, t) {
  const message = resolveErrorMessage(error, '');

  if (message === 'Subscription is not active') {
    return {
      type: 'inactive',
      message: t('contract.subscriptionInactive'),
    };
  }

  if (message === 'Subscription limit reached') {
    return {
      type: 'limit',
      message: t('contract.subscriptionLimitReached'),
    };
  }

  return null;
}

function getActiveSession(session) {
  if (!session || isSessionExpired(session.expiresAt)) {
    return null;
  }

  if (!session.accessGranted) {
    return null;
  }

  return session;
}

function buildGenerationSessionPayload(session, order, contractData, documentType) {
  return {
    accessGranted: true,
    orderId: String(order?.id || session?.orderId || ''),
    orderNumber: String(order?.orderNumber || session?.orderNumber || ''),
    documentType: String(documentType || session?.documentType || ''),
    contractData,
    createdAt: String(session?.createdAt || order?.createdAt || new Date().toISOString()),
    expiresAt:
      String(session?.expiresAt || new Date(Date.now() + getGenerationWindowMs()).toISOString()),
  };
}

function OrderCreatedModal({ orderNumber, onClose, t }) {
  if (!orderNumber) {
    return null;
  }

  return (
    <div className="contractActionsModal" role="presentation">
      <div className="contractActionsModal-backdrop" onClick={onClose} />

      <div
        className="contractActionsModal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orderCreatedTitle"
      >
        <button
          className="contractActionsModal-close"
          type="button"
          aria-label={t('contract.close')}
          onClick={onClose}
        >
          ×
        </button>

        <div className="contractActionsModal-badge" aria-hidden="true">
          <span className="contractActionsModal-badgeIcon">✓</span>
          <span>{t('contract.success')}</span>
        </div>

        <div className="contractActionsModal-copy">
          <h2 id="orderCreatedTitle">{t('contract.orderCreated')}</h2>
          <p>{t('contract.orderSaved')}</p>
        </div>

        <div className="contractActionsModal-card">
          <span>{t('contract.orderNumber')}</span>
          <strong>{orderNumber}</strong>
        </div>

        <button className="contractActionsModal-confirm" type="button" onClick={onClose}>
          {t('contract.backToHome')}
        </button>
      </div>
    </div>
  );
}

// Пояснює, що створення замовлень заблоковане до оновлення плану.
function PlanUpgradeRequiredModal({ errorState, onClose, onOpenAccount, t }) {
  if (!errorState?.type) {
    return null;
  }

  const title =
    errorState.type === 'inactive'
      ? t('contract.planExpiredTitle')
      : t('contract.planLimitTitle');

  const eyebrow =
    errorState.type === 'inactive'
      ? t('account.planExpiredEyebrow')
      : t('contract.planLimitEyebrow');

  const copy =
    errorState.type === 'inactive'
      ? t('contract.planExpiredOrderCopy')
      : t('contract.planLimitCopy');

  return (
    <div className="contractActionsModal" role="presentation">
      <div className="contractActionsModal-backdrop" onClick={onClose} />

      <div
        className="contractActionsModal-sheet contractActionsModal-sheet--warning"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planUpgradeRequiredTitle"
      >
        <button
          className="contractActionsModal-close"
          type="button"
          aria-label={t('contract.close')}
          onClick={onClose}
        >
          ×
        </button>

        <div className="contractActionsModal-badge contractActionsModal-badge--warning" aria-hidden="true">
          <span className="contractActionsModal-badgeIcon contractActionsModal-badgeIcon--warning">!</span>
          <span>{eyebrow}</span>
        </div>

        <div className="contractActionsModal-copy">
          <h2 id="planUpgradeRequiredTitle">{title}</h2>
          <p>{copy}</p>
          <p>{errorState.message}</p>
        </div>

        <button className="contractActionsModal-confirm contractActionsModal-confirm--warning" type="button" onClick={onOpenAccount}>
          {t('contract.openAccountForUpgrade')}
        </button>

        <button className="contractActionsModal-secondary" type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

export function ContractActions() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const contract = useSelector(selectContract);
  const generationSession = useSelector(selectGenerationSession);
  const { t } = useI18n();
  const [createOrder, { isLoading: isCreatingNew }] = useCreateOrderMutation();
  const [updateOrder, { isLoading: isCreating }] = useUpdateOrderMutation();
  const [generateContractPdf, { isLoading: isGenerating }] =
    useGenerateContractPdfMutation();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [subscriptionErrorState, setSubscriptionErrorState] = useState(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  const [validationErrors, setValidationErrors] = useState(buildValidationState());

  function clearValidation() {
    setValidationErrors(buildValidationState());
  }

  function showValidation(result) {
    setValidationErrors({
      ...buildValidationState(),
      ...result.errors,
    });
  }

  function closeCreatedModal() {
    setCreatedOrderNumber('');
    dispatch(clearSession());
    navigate('/', { replace: true });
  }

  function closeSubscriptionModal() {
    setSubscriptionErrorState(null);
  }

  function openAccountUpgrade() {
    setSubscriptionErrorState(null);
    navigate('/settings/plan-upgrade');
  }

  async function handleCreate() {
    setMessage('');
    setError('');
    setSubscriptionErrorState(null);
    setCreatedOrderNumber('');
    clearValidation();

    const payloadContract = buildContractPayload(contract);
    const result = validateContract(payloadContract);
    if (!result.isValid) {
      showValidation(result);
      return;
    }

    try {
      const activeSession = getActiveSession(generationSession);
      if (!activeSession) {
        setError(t('contract.openOrdersAgain'));
        return;
      }

      const documentType = activeSession.documentType || payloadContract.documentType;
      const payload = {
        contractData: payloadContract,
        status: 'created',
        metadata: {
          sourcePage: getSourcePage(),
          documentType,
          generationMode: 'token',
          tokenCost: 1,
        },
      };

      const response = activeSession.orderId
        ? await updateOrder({
            orderId: activeSession.orderId,
            payload,
          }).unwrap()
        : await createOrder(payload).unwrap();

      const order = response?.order || response;
      dispatch(resetContract());
      setCreatedOrderNumber(String(order?.orderNumber || ''));
    } catch (error) {
      const nextSubscriptionErrorState = getSubscriptionErrorState(error, t);
      if (nextSubscriptionErrorState) {
        setSubscriptionErrorState(nextSubscriptionErrorState);
        return;
      }

      setError(getSubscriptionErrorMessage(error, t));
    }
  }

  async function handleDownload() {
    setMessage('');
    setError('');
    setSubscriptionErrorState(null);
    clearValidation();

    const activeSession = getActiveSession(generationSession);
    const payloadContract = buildContractPayload(contract);
    const result = validateContract(payloadContract);
    if (!result.isValid) {
      showValidation(result);
      return;
    }

    let orderId = String(activeSession?.orderId || '');
    let orderNumber = String(activeSession?.orderNumber || 'contract');
    const documentType = activeSession?.documentType || payloadContract.documentType;

    if (!orderId) {
      try {
        const response = await createOrder({
          contractData: payloadContract,
          status: 'pending_pdf',
          metadata: {
            sourcePage: getSourcePage(),
            documentType,
            generationMode: 'token',
            tokenCost: 1,
            generationWindowMs: getGenerationWindowMs(),
          },
        }).unwrap();

      const order = response?.order || response;
      orderId = String(order?.id || '');
      orderNumber = String(order?.orderNumber || 'contract');
        const nextSession = buildGenerationSessionPayload(
          activeSession,
          order,
          payloadContract,
          documentType,
        );
        dispatch(startSession(nextSession));
      } catch (error) {
        const nextSubscriptionErrorState = getSubscriptionErrorState(error, t);
        if (nextSubscriptionErrorState) {
          setSubscriptionErrorState(nextSubscriptionErrorState);
          return;
        }

        setError(getSubscriptionErrorMessage(error, t));
        return;
      }
    }

    try {
      const blob = await generateContractPdf({
        orderId,
        documentType,
        contractData: payloadContract,
      }).unwrap();

      const fileName = `${orderNumber}.pdf`;
      downloadFile(blob, fileName);
      setMessage(t('contract.pdfDownloaded'));

      try {
        await updateOrder({
          orderId,
          skipInvalidation: true,
          payload: {
            status: 'pdf_generated',
            metadata: {
              sourcePage: getSourcePage(),
              documentType,
              generationMode: 'token',
              tokenCost: 1,
            },
            pdf: {
              documentType,
            },
          },
        }).unwrap();
      } catch (updateError) {
        console.error(
          'Failed to update order status after PDF download:',
          updateError,
        );
      }

      dispatch(clearSession());
    } catch (error) {
      if (orderId) {
        try {
          await updateOrder({
            orderId,
            skipInvalidation: true,
            payload: {
              status: 'pdf_failed',
              metadata: {
                sourcePage: getSourcePage(),
                documentType,
                generationMode: 'token',
                tokenCost: 1,
              },
            },
          }).unwrap();
        } catch (updateError) {
          console.error(
            'Failed to mark PDF generation as failed:',
            updateError,
          );
        }
      }

      setError(resolveErrorMessage(error, t('contract.failedGeneratePdf')));
    }
  }

  return (
    <>
      <section className="contractActions">
        {validationErrors.customerName ? (
          <p className="contractActions-error contractActions-fullWidth">
            {validationErrors.customerName}
          </p>
        ) : null}
        {validationErrors.customerContact ? (
          <p className="contractActions-error contractActions-fullWidth">
            {validationErrors.customerContact}
          </p>
        ) : null}
        {validationErrors.passengers ? (
          <p className="contractActions-error contractActions-fullWidth">
            {validationErrors.passengers}
          </p>
        ) : null}
        {validationErrors.fromAddress ? (
          <p className="contractActions-error contractActions-fullWidth">
            {validationErrors.fromAddress}
          </p>
        ) : null}
        {validationErrors.toAddress ? (
          <p className="contractActions-error contractActions-fullWidth">
            {validationErrors.toAddress}
          </p>
        ) : null}
        {validationErrors.tripDate ? (
          <p className="contractActions-error contractActions-fullWidth">
            {validationErrors.tripDate}
          </p>
        ) : null}
        {validationErrors.paymentMethod ? (
          <p className="contractActions-error contractActions-fullWidth">
            {validationErrors.paymentMethod}
          </p>
        ) : null}
        {validationErrors.totalPrice ? (
          <p className="contractActions-error contractActions-fullWidth">
            {validationErrors.totalPrice}
          </p>
        ) : null}

        <button
          className="contractActions-save"
          type="button"
          onClick={handleCreate}
          disabled={isCreating || isCreatingNew}
        >
          {isCreating || isCreatingNew ? (
            <RequestLoader inline size="sm" label={t('common.creating')} />
          ) : (
            t('contract.saveOrder')
          )}
        </button>

        <button
          className="contractActions-generate"
          type="button"
          onClick={handleDownload}
          disabled={isGenerating || isCreating || isCreatingNew}
        >
          {isGenerating ? (
            <RequestLoader inline size="sm" label={t('common.downloading')} />
          ) : (
            t('contract.downloadPdf')
          )}
        </button>

        {generationSession.accessGranted ? (
          <p className="contractActions-sessionLine">
            {generationSession.orderNumber
              ? `${t('contract.orderReserved')}: ${generationSession.orderNumber}`
              : t('contract.tokenSessionActive')}
          </p>
        ) : null}

        {message ? <p className="contractActions-message">{message}</p> : null}
        {error ? <p className="contractActions-error">{error}</p> : null}
      </section>

      <OrderCreatedModal orderNumber={createdOrderNumber} onClose={closeCreatedModal} t={t} />
      <PlanUpgradeRequiredModal
        errorState={subscriptionErrorState}
        onClose={closeSubscriptionModal}
        onOpenAccount={openAccountUpgrade}
        t={t}
      />
    </>
  );
}
