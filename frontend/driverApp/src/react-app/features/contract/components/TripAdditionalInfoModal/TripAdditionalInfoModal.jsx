import { useEffect, useState } from 'react';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { normalizeChildSeats, toCount } from './additionalInfoUtils.js';
import './TripAdditionalInfoModal.css';

const CHILD_SEAT_OPTIONS = [
  {
    key: 'infant',
    titleKey: 'contract.infantCarrier',
    subtitleKey: 'contract.infantCarrierAge',
    decrementKey: 'contract.decreaseInfantCarrier',
    incrementKey: 'contract.increaseInfantCarrier',
  },
  {
    key: 'child',
    titleKey: 'contract.childSeat',
    subtitleKey: 'contract.childSeatAge',
    decrementKey: 'contract.decreaseChildSeat',
    incrementKey: 'contract.increaseChildSeat',
  },
  {
    key: 'booster',
    titleKey: 'contract.boosterSeat',
    subtitleKey: 'contract.boosterSeatAge',
    decrementKey: 'contract.decreaseBoosterSeat',
    incrementKey: 'contract.increaseBoosterSeat',
  },
];

export function TripAdditionalInfoModal({
  isOpen,
  flightNumber,
  driverComment,
  luggageUnits,
  childSeats,
  onClose,
  onFlightNumberChange,
  onDriverCommentChange,
  onLuggageUnitsChange,
  onChildSeatsChange,
}) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const resolvedLuggageUnits = toCount(luggageUnits);
  const resolvedChildSeats = normalizeChildSeats(childSeats);

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      return undefined;
    }

    const body = document.body;
    body.classList.add('no-scroll');
    const frameId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      body.classList.remove('no-scroll');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  function updateChildSeats(patch) {
    onChildSeatsChange({
      ...resolvedChildSeats,
      ...patch,
    });
  }

  function updateChildSeatCount(key, nextValue) {
    updateChildSeats({
      [key]: toCount(nextValue),
    });
  }

  return (
    <div className={`tripAdditionalModal ${isVisible ? 'is-visible' : ''}`} role="presentation">
      <div className="tripAdditionalModal-backdrop" onClick={onClose} />

      <aside
        className="tripAdditionalModal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tripAdditionalTitle"
      >
        <div className="tripAdditionalModal-header">
          <div className="tripAdditionalModal-copy">
            <h3 id="tripAdditionalTitle">{t('contract.additionalInfo')}</h3>
            <p>{t('contract.additionalInfoHint')}</p>
          </div>
          <button
            className="tripAdditionalModal-close"
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="tripAdditionalModal-fields">
          <section className="tripAdditionalModal-section">
            <div className="tripAdditionalModal-sectionHeader">
              <h4>{t('contract.luggageUnits')}</h4>
              <CounterControl
                value={resolvedLuggageUnits}
                decrementLabel={t('contract.decreaseLuggageUnits')}
                incrementLabel={t('contract.increaseLuggageUnits')}
                onChange={onLuggageUnitsChange}
              />
            </div>
            <p>{t('contract.luggageUnitsHint')}</p>
          </section>

          <label className="tripAdditionalModal-field">
            <span>{t('contract.flightNumber')}</span>
            <input
              value={flightNumber || ''}
              placeholder={t('contract.flightNumber')}
              onChange={event => onFlightNumberChange(event.target.value.toUpperCase())}
            />
          </label>

          <label className="tripAdditionalModal-field">
            <span>{t('contract.driverComment')}</span>
            <textarea
              value={driverComment || ''}
              placeholder={t('contract.driverCommentPlaceholder')}
              onChange={event => onDriverCommentChange(event.target.value)}
            />
          </label>

          <section className="tripAdditionalModal-childSeats">
            <label className="tripAdditionalModal-checkbox">
              <input
                type="checkbox"
                checked={resolvedChildSeats.enabled}
                onChange={event => updateChildSeats({ enabled: event.target.checked })}
              />
              <span className="tripAdditionalModal-checkboxBox" aria-hidden="true" />
              <span>{t('contract.addChildSeats')}</span>
            </label>

            {resolvedChildSeats.enabled ? (
              <div className="tripAdditionalModal-seatList">
                {CHILD_SEAT_OPTIONS.map(option => (
                  <SeatCounter
                    key={option.key}
                    title={t(option.titleKey)}
                    subtitle={t(option.subtitleKey)}
                    value={resolvedChildSeats[option.key]}
                    decrementLabel={t(option.decrementKey)}
                    incrementLabel={t(option.incrementKey)}
                    onChange={value => updateChildSeatCount(option.key, value)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <button className="tripAdditionalModal-done" type="button" onClick={onClose}>
          {t('common.save')}
        </button>
      </aside>
    </div>
  );
}

function CounterControl({
  value,
  decrementLabel,
  incrementLabel,
  onChange,
}) {
  const count = toCount(value);

  return (
    <div className="tripAdditionalCounter" role="group">
      <button
        className="tripAdditionalCounter-button"
        type="button"
        aria-label={decrementLabel}
        onClick={() => onChange(Math.max(0, count - 1))}
      >
        -
      </button>
      <span className="tripAdditionalCounter-value">{count}</span>
      <button
        className="tripAdditionalCounter-button"
        type="button"
        aria-label={incrementLabel}
        onClick={() => onChange(count + 1)}
      >
        +
      </button>
    </div>
  );
}

function SeatCounter({
  title,
  subtitle,
  value,
  decrementLabel,
  incrementLabel,
  onChange,
}) {
  return (
    <div className="tripAdditionalSeat">
      <div className="tripAdditionalSeat-copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <CounterControl
        value={value}
        decrementLabel={decrementLabel}
        incrementLabel={incrementLabel}
        onChange={onChange}
      />
    </div>
  );
}
