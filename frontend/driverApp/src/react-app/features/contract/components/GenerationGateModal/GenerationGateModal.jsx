import { RequestLoader } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './GenerationGateModal.css';

export function GenerationGateModal({
  isOpen,
  isBusy = false,
  onClose,
  onConfirm,
}) {
  const { t } = useI18n();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="generationGateModal" role="presentation">
      <div className="generationGateBackdrop" onClick={onClose} />

      <div
        className="generationGateSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generationGateTitle"
      >
        <div className="generationGateHeader">
          <div className="generationGateHeading">
            <span className="generationTokenBadge">
              <span className="generationTokenBadgeIcon" aria-hidden="true" />
              <span>{t('contract.tokens')}</span>
            </span>
            <h2 id="generationGateTitle">{t('contract.tenMinutes')}</h2>
            <p>{t('contract.oneTokenUsed')}</p>
          </div>

          <button
            className="generationGateCloseBtn"
            type="button"
            aria-label={t('contract.closeModal')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="generationGateStats">
          <article className="generationGateStat">
            <span>{t('contract.tokenCost')}</span>
            <strong className="generationGateTokenValue">
              <span className="generationGateTokenValueIcon" aria-hidden="true" />
              <span>1T</span>
            </strong>
          </article>

          <article className="generationGateStat">
            <span>{t('contract.window')}</span>
            <strong>{t('contract.tenMinutes')}</strong>
          </article>
        </div>

        <p className="generationGateHint">{t('contract.confirmStart')}</p>

        <div className="generationGateActions">
          <button
            className="generationGateConfirmBtn"
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? <RequestLoader inline size="sm" label={t('contract.starting')} /> : t('contract.startOrder')}
          </button>

          <button
            className="generationGateLaterBtn"
            type="button"
            onClick={onClose}
            disabled={isBusy}
          >
            {t('contract.startLater')}
          </button>
        </div>
      </div>
    </div>
  );
}
