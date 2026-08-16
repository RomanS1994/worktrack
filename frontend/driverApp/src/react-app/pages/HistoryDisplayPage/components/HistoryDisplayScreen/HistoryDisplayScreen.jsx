import { useState } from 'react';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './HistoryDisplayScreen.css';

const TEXT_SIZES = {
  compact: 'historyDisplayScreen-name--compact',
  small: 'historyDisplayScreen-name--small',
  medium: 'historyDisplayScreen-name--medium',
  large: 'historyDisplayScreen-name--large',
  huge: 'historyDisplayScreen-name--huge',
};

function HistoryDisplayScreen({
  customerName,
  isLoading,
  isError,
  themeId,
  themeOptions,
  textSize,
  textSizeOptions,
  onThemeChange,
  onTextSizeChange,
  onBack,
}) {
  const { t } = useI18n();
  const [isControlsOpen, setIsControlsOpen] = useState(true);

  function toggleControls() {
    setIsControlsOpen(value => !value);
  }

  return (
    <div className="historyDisplayScreen">
      <header className="historyDisplayScreen-top">
        <BackButton label={t('history.back')} onClick={onBack} />

        <div className="historyDisplayScreen-toolbar">
          <button
            className="historyDisplayScreen-controlsToggle"
            type="button"
            aria-label={isControlsOpen ? t('history.hideDisplayControls') : t('history.showDisplayControls')}
            aria-expanded={isControlsOpen}
            onClick={toggleControls}
          >
            <SvgIcon name="settings" />
          </button>

          <div className={`historyDisplayScreen-controlsPanel ${isControlsOpen ? 'is-open' : 'is-closed'}`}>
            <div className="historyDisplayScreen-controls">
              <div className="historyDisplayScreen-control">
                <span className="historyDisplayScreen-controlLabel">{t('history.text')}</span>
                <label className="historyDisplayScreen-selectShell">
                  <span className="historyDisplayScreen-selectIcon" aria-hidden="true">
                    Aa
                  </span>
                  <select
                    className="historyDisplayScreen-select"
                    aria-label={t('history.text')}
                    value={textSize}
                    onChange={event => onTextSizeChange(event.target.value)}
                  >
                    {textSizeOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="historyDisplayScreen-control">
                <span className="historyDisplayScreen-controlLabel">{t('history.background')}</span>
                <label className="historyDisplayScreen-selectShell">
                  <span
                    className="historyDisplayScreen-selectSwatch"
                    style={{ '--swatch-color': themeOptions.find(option => option.id === themeId)?.swatch || '#eef3ff' }}
                    aria-hidden="true"
                  />
                  <select
                    className="historyDisplayScreen-select"
                    aria-label={t('history.background')}
                    value={themeId}
                    onChange={event => onThemeChange(event.target.value)}
                  >
                    {themeOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="historyDisplayScreen-body">
        {isLoading ? (
          <RequestLoadingState className="historyDisplayScreen-state" label={t('history.loadingOrder')} />
        ) : null}
        {isError ? <p className="historyDisplayScreen-state">{t('history.failedToLoadOrder')}</p> : null}

        {!isLoading && !isError ? (
          <div className="historyDisplayScreen-copy">
            <h1 className={`historyDisplayScreen-name ${TEXT_SIZES[textSize]}`}>{customerName}</h1>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export { HistoryDisplayScreen };
