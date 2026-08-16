import { useEffect, useRef, useState } from 'react';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './TripDateTimePickerModal.css';

const MINUTE_STEP = 5;
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_HEIGHT = 220;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, '0'),
);
const MINUTE_OPTIONS = Array.from(
  { length: 60 / MINUTE_STEP },
  (_, index) => String(index * MINUTE_STEP).padStart(2, '0'),
);

export function TripDateTimePickerModal({ isOpen, value, onClose, onSave }) {
  const { language, t } = useI18n();
  const dateInputRef = useRef(null);
  const timePickerAudioRef = useRef(null);
  const timePickerInteractionRef = useRef(false);
  const previousTimePickerValueRef = useRef('');
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState({
    hour: '00',
    minute: '00',
  });
  const draftDateLabel = draftDate ? formatDateLabel(draftDate, language) : '';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextDraft = buildPickerDraft(value);
    timePickerInteractionRef.current = false;
    previousTimePickerValueRef.current = `${nextDraft.hour}:${nextDraft.minute}`;
    setDraftDate(nextDraft.date);
    setDraftTime({
      hour: nextDraft.hour,
      minute: nextDraft.minute,
    });
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, onClose]);

  useEffect(() => {
    const currentValue = `${draftTime.hour}:${draftTime.minute}`;

    if (!isOpen) {
      previousTimePickerValueRef.current = currentValue;
      return;
    }

    if (!previousTimePickerValueRef.current) {
      previousTimePickerValueRef.current = currentValue;
      return;
    }

    if (
      timePickerInteractionRef.current &&
      previousTimePickerValueRef.current !== currentValue
    ) {
      playTimePickerTick();
    }

    previousTimePickerValueRef.current = currentValue;
  }, [draftTime.hour, draftTime.minute, isOpen]);

  if (!isOpen) {
    return null;
  }

  function openDatePicker() {
    const input = dateInputRef.current;

    if (!input) {
      return;
    }

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.click();
  }

  function prepareTimePickerAudio() {
    timePickerInteractionRef.current = true;

    if (typeof window === 'undefined') {
      return;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }

    if (!timePickerAudioRef.current) {
      timePickerAudioRef.current = new AudioContextConstructor();
    }

    if (timePickerAudioRef.current.state === 'suspended') {
      timePickerAudioRef.current.resume().catch(() => {});
    }
  }

  function playTimePickerTick() {
    const audioContext = timePickerAudioRef.current;

    if (!audioContext || audioContext.state === 'closed') {
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
      return;
    }

    const startedAt = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(900, startedAt);
    oscillator.frequency.exponentialRampToValueAtTime(560, startedAt + 0.018);
    gain.gain.setValueAtTime(0.0001, startedAt);
    gain.gain.exponentialRampToValueAtTime(0.08, startedAt + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.035);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startedAt);
    oscillator.stop(startedAt + 0.04);
  }

  function handleSave() {
    if (!draftDate) {
      return;
    }

    onSave(`${draftDate}T${draftTime.hour}:${draftTime.minute}`);
  }

  return (
    <div className="contractDatePickerModal" role="presentation">
      <div className="contractDatePickerModal-backdrop" onClick={onClose} />

      <div
        className="contractDatePickerModal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contractDatePickerTitle"
      >
        <div className="contractDatePickerModal-handle" aria-hidden="true" />

        <div className="contractDatePickerModal-header">
          <div className="contractDatePickerModal-copy">
            <h3 id="contractDatePickerTitle">{t('contract.pickupDateTime')}</h3>
            <p>{getPickupTimeHint(language)}</p>
          </div>
          <button
            className="contractDatePickerModal-close"
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="contractDatePickerModal-body">
          <div className="contractDatePickerField">
            <span className="contractDatePickerLabel">{t('common.date')}</span>
            <label className="contractDatePickerDateField" onClick={openDatePicker}>
              <input
                ref={dateInputRef}
                className="contractDatePickerDateNativeInput"
                type="date"
                value={draftDate}
                onChange={event => setDraftDate(event.target.value)}
              />
              <div className="contractDatePickerDateSurface" aria-hidden="true">
                <span className="contractDatePickerDateIcon">
                  <SvgIcon name="calendar" />
                </span>
                <span className={`contractDatePickerDateValue ${draftDateLabel ? '' : 'is-placeholder'}`}>
                  {draftDateLabel || t('common.date')}
                </span>
                <span className="contractDatePickerDateChevron">
                  <SvgIcon name="chevron-right" />
                </span>
              </div>
            </label>
          </div>

          <div className="contractDatePickerField">
            <span className="contractDatePickerLabel">{t('contract.tripTime')}</span>
            <div
              className="contractDatePickerWheel"
              onPointerDown={prepareTimePickerAudio}
              onTouchStart={prepareTimePickerAudio}
              onWheel={prepareTimePickerAudio}
              onKeyDown={prepareTimePickerAudio}
            >
              <div className="contractDatePickerWheelColumns">
                <TimeWheelColumn
                  idPrefix="time-wheel-hour"
                  ariaLabel={t('contract.tripTime')}
                  options={HOUR_OPTIONS}
                  value={draftTime.hour}
                  onChange={hour => setDraftTime(current => ({ ...current, hour }))}
                />
                <TimeWheelColumn
                  idPrefix="time-wheel-minute"
                  ariaLabel={t('contract.tripTime')}
                  options={MINUTE_OPTIONS}
                  value={draftTime.minute}
                  onChange={minute => setDraftTime(current => ({ ...current, minute }))}
                />
              </div>
              <div className="contractDatePickerWheelSeparator" aria-hidden="true">
                :
              </div>
            </div>
          </div>
        </div>

        <div className="contractDatePickerModal-actions">
          <button
            className="contractDatePickerModal-secondary"
            type="button"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            className="contractDatePickerModal-primary"
            type="button"
            onClick={handleSave}
            disabled={!draftDate}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeWheelColumn({ idPrefix, ariaLabel, options, value, onChange }) {
  const scrollRef = useRef(null);
  const scrollEndTimerRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const isUserScrollingRef = useRef(false);

  useEffect(() => {
    const selectedIndex = Math.max(0, options.indexOf(value));
    const element = scrollRef.current;

    if (!element || isUserScrollingRef.current) {
      return;
    }

    const nextTop = selectedIndex * WHEEL_ITEM_HEIGHT;
    if (Math.abs(element.scrollTop - nextTop) < 1) {
      return;
    }

    isProgrammaticScrollRef.current = true;
    element.scrollTo({
      top: nextTop,
      behavior: 'auto',
    });
    window.requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, [options, value]);

  useEffect(() => () => {
    if (scrollEndTimerRef.current) {
      window.clearTimeout(scrollEndTimerRef.current);
    }
  }, []);

  function getNearestValue(scrollTop) {
    const nextIndex = Math.max(
      0,
      Math.min(options.length - 1, Math.round(scrollTop / WHEEL_ITEM_HEIGHT)),
    );
    return options[nextIndex];
  }

  function handleScroll(event) {
    if (isProgrammaticScrollRef.current) {
      return;
    }

    isUserScrollingRef.current = true;
    const nextValue = getNearestValue(event.currentTarget.scrollTop);
    if (nextValue && nextValue !== value) {
      onChange(nextValue);
    }

    if (scrollEndTimerRef.current) {
      window.clearTimeout(scrollEndTimerRef.current);
    }

    scrollEndTimerRef.current = window.setTimeout(() => {
      const element = scrollRef.current;
      if (!element) {
        return;
      }

      const snappedValue = getNearestValue(element.scrollTop);
      const snappedIndex = options.indexOf(snappedValue);
      isProgrammaticScrollRef.current = true;
      element.scrollTo({
        top: snappedIndex * WHEEL_ITEM_HEIGHT,
        behavior: 'smooth',
      });
      window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        isUserScrollingRef.current = false;
      }, 180);
    }, 90);
  }

  function handleItemClick(option) {
    const element = scrollRef.current;
    const selectedIndex = options.indexOf(option);

    if (!element || selectedIndex < 0) {
      return;
    }

    onChange(option);
    isProgrammaticScrollRef.current = true;
    element.scrollTo({
      top: selectedIndex * WHEEL_ITEM_HEIGHT,
      behavior: 'smooth',
    });
    window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      isUserScrollingRef.current = false;
    }, 180);
  }

  return (
    <div
      ref={scrollRef}
      className="contractDatePickerWheelColumn"
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={`${idPrefix}-${value}`}
      onScroll={handleScroll}
    >
      <div className="contractDatePickerWheelColumnTrack">
        {options.map(option => {
          const selected = option === value;

          return (
            <button
              id={`${idPrefix}-${option}`}
              key={option}
              className={`contractDatePickerWheelItem ${selected ? 'is-selected' : ''}`}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => handleItemClick(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDateLabel(value, language) {
  const date = toDateValue(`${value}T00:00`);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(language || 'en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getPickupTimeHint(language) {
  if (language === 'uk') {
    return 'Оберіть час подачі автомобіля';
  }

  if (language === 'cs') {
    return 'Zvolte čas přistavení vozidla';
  }

  return 'Choose the vehicle pickup time';
}

function buildPickerDraft(value) {
  const sourceDate = value ? toDateValue(value) : new Date();
  const alignedDate = alignDateToMinuteStep(sourceDate || new Date(), MINUTE_STEP);

  return {
    date: formatDateInputValue(alignedDate),
    hour: String(alignedDate.getHours()).padStart(2, '0'),
    minute: String(alignedDate.getMinutes()).padStart(2, '0'),
  };
}

function alignDateToMinuteStep(date, step) {
  const nextDate = new Date(date);

  if (Number.isNaN(nextDate.getTime())) {
    return new Date();
  }

  nextDate.setSeconds(0, 0);
  const remainder = nextDate.getMinutes() % step;

  if (remainder !== 0) {
    nextDate.setMinutes(nextDate.getMinutes() + (step - remainder));
  }

  return nextDate;
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function toDateValue(value) {
  const text = toDateTimeLocalValue(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateTimeLocalValue(value) {
  const text = String(value ?? '').trim();

  if (!text) {
    return '';
  }

  const match = text.match(
    /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/,
  );

  if (match) {
    return `${match[1]}T${match[2] || '00:00'}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}T${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}
