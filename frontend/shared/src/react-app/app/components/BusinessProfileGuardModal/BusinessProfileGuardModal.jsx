import { Link } from 'react-router-dom';

import { useI18n } from '../../i18n/useI18n.js';
import { SvgIcon } from '../SvgIcon/SvgIcon.jsx';
import './BusinessProfileGuardModal.css';

export function BusinessProfileGuardModal({ isOpen, onLater, onOpenSettings }) {
  const { t } = useI18n();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="businessProfileGuardModal" role="presentation">
      <div className="businessProfileGuardModal-backdrop" />

      <div
        className="businessProfileGuardModal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="businessProfileGuardTitle"
      >
        <div className="businessProfileGuardModal-copy">
          <p className="businessProfileGuardModal-eyebrow">{t('contract.guardEyebrow')}</p>
          <h2 id="businessProfileGuardTitle">{t('contract.guardTitle')}</h2>
          <p>{t('contract.guardCopy')}</p>
        </div>

        <div className="businessProfileGuardModal-actions">
          <Link
            className="businessProfileGuardModal-link"
            to="/settings/business-profile"
            onClick={onOpenSettings}
          >
            <span className="businessProfileGuardModal-linkIcon" aria-hidden="true">
              <SvgIcon name="gear" />
            </span>
            {t('contract.guardSettings')}
          </Link>

          <button className="businessProfileGuardModal-button" type="button" onClick={onLater}>
            {t('contract.guardLater')}
          </button>
        </div>
      </div>
    </div>
  );
}
