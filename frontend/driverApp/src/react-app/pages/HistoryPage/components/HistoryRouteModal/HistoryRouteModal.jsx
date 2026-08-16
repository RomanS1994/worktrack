import { useEffect } from 'react';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './HistoryRouteModal.css';

const WAZE_ICON_URL = '/icons/waze.svg';
const GOOGLE_MAPS_ICON_URL = 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Google_Maps_icon_%282020%29.svg';

function buildWazeUrl(address) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function buildGoogleMapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function RouteIcon() {
  return <SvgIcon name="route" />;
}

// Показує адресу та відкриває маршрути в навігаторах.
export function HistoryRouteModal({ address, label, onClose, t }) {
  useEffect(() => {
    if (!address) {
      return undefined;
    }

    const body = document.body;
    body.classList.add('no-scroll');

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      body.classList.remove('no-scroll');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [address, onClose]);

  if (!address) {
    return null;
  }

  return (
    <div className="historyRouteModal" role="presentation" onClick={onClose}>
      <div
        className="historyRouteModal-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="historyRouteModal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('history.routeModalTitle')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="historyRouteModal-icon" aria-hidden="true">
          <RouteIcon />
        </div>

        <div className="historyRouteModal-copy">
          <p className="historyRouteModal-eyebrow">{label || t('history.routeAddress')}</p>
          <h3>{t('history.routeModalTitle')}</h3>
          <p>{t('history.routeModalCopy')}</p>
          <p>{address}</p>
        </div>

        <div className="historyRouteModal-actions">
          <a
            className="historyRouteModal-button historyRouteModal-button--waze"
            href={buildWazeUrl(address)}
            target="_blank"
            rel="noreferrer"
          >
            <span className="historyRouteModal-buttonIcon historyRouteModal-buttonIcon--waze" aria-hidden="true">
              <img src={WAZE_ICON_URL} alt="" loading="eager" decoding="async" />
            </span>
            <span>{t('history.routeModalWaze')}</span>
          </a>
          <a
            className="historyRouteModal-button historyRouteModal-button--google"
            href={buildGoogleMapsUrl(address)}
            target="_blank"
            rel="noreferrer"
          >
            <span className="historyRouteModal-buttonIcon historyRouteModal-buttonIcon--google" aria-hidden="true">
              <img src={GOOGLE_MAPS_ICON_URL} alt="" loading="eager" decoding="async" />
            </span>
            <span>{t('history.routeModalGoogleMaps')}</span>
          </a>
        </div>

        <button className="historyRouteModal-close" type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
