import { useEffect, useMemo, useState } from 'react';
import Picker from 'react-mobile-picker';

import { useI18n } from '@shared/app/i18n/useI18n.js';

const MIN_YEAR = 1900;
const DEFAULT_YEAR = '1990';
const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) =>
  String(index + 1).padStart(2, '0'),
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, '0'),
);

export function CustomerBirthDatePickerModal({ isOpen, value, onClose, onSave }) {
  const { language, t } = useI18n();
  const [draftDate, setDraftDate] = useState(() => buildDraftDate(value));
  const yearOptions = useMemo(() => getYearOptions(), []);
  const dayOptions = useMemo(
    () => getDayOptions(draftDate.year, draftDate.month),
    [draftDate.year, draftDate.month],
  );
  const pickerOptions = useMemo(
    () => ({
      day: dayOptions,
      month: MONTH_OPTIONS,
      year: yearOptions,
    }),
    [dayOptions, yearOptions],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftDate(buildDraftDate(value));
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
    const maxDay = getDaysInMonth(draftDate.year, draftDate.month);
    const currentDay = Number(draftDate.day);

    if (currentDay > maxDay) {
      setDraftDate(current => ({
        ...current,
        day: String(maxDay).padStart(2, '0'),
      }));
    }
  }, [draftDate.day, draftDate.month, draftDate.year]);

  if (!isOpen) {
    return null;
  }

  function handleSave() {
    onSave(`${draftDate.year}-${draftDate.month}-${draftDate.day}`);
  }

  function handlePickerChange(nextValue) {
    setDraftDate(current => {
      const nextDate = {
        ...current,
        ...nextValue,
      };
      const maxDay = getDaysInMonth(nextDate.year, nextDate.month);

      if (Number(nextDate.day) > maxDay) {
        nextDate.day = String(maxDay).padStart(2, '0');
      }

      return nextDate;
    });
  }

  return (
    <div className="customerBirthDatePickerModal" role="presentation">
      <div className="customerBirthDatePickerModal-backdrop" onClick={onClose} />

      <div
        className="customerBirthDatePickerModal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customerBirthDatePickerTitle"
      >
        <div className="customerBirthDatePickerModal-handle" aria-hidden="true" />

        <div className="customerBirthDatePickerModal-header">
          <div className="customerBirthDatePickerModal-copy">
            <h3 id="customerBirthDatePickerTitle">{t('contract.customerBirthDate')}</h3>
            <p>{getBirthDatePickerHint(language)}</p>
          </div>
          <button
            className="customerBirthDatePickerModal-close"
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="customerBirthDatePickerWheel" aria-label={t('contract.customerBirthDate')}>
          <Picker
            value={draftDate}
            onChange={handlePickerChange}
            height={200}
            itemHeight={40}
            wheelMode="natural"
          >
            {Object.entries(pickerOptions).map(([name, options]) => (
              <Picker.Column key={name} name={name} style={getPickerColumnStyle(name)}>
                {options.map(option => (
                  <Picker.Item key={option} value={option}>
                    {({ selected }) => (
                      <span
                        className={`customerBirthDatePickerWheelItem ${selected ? 'is-selected' : ''}`}
                        aria-label={getDatePartLabel(language, name)}
                      >
                        {option}
                      </span>
                    )}
                  </Picker.Item>
                ))}
              </Picker.Column>
            ))}
          </Picker>
          <div className="customerBirthDatePickerSeparators" aria-hidden="true">
            <span>.</span>
            <span>.</span>
          </div>
        </div>

        <div className="customerBirthDatePickerModal-actions">
          <button
            className="customerBirthDatePickerModal-secondary"
            type="button"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            className="customerBirthDatePickerModal-primary"
            type="button"
            onClick={handleSave}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function parseBirthDateParts(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);

  if (!match) {
    return {
      day: '',
      month: '',
      year: '',
    };
  }

  return {
    day: match[3],
    month: match[2],
    year: match[1],
  };
}

export function formatBirthDateDisplay(value) {
  const parts = parseBirthDateParts(value);

  if (!parts.day || !parts.month || !parts.year) {
    return '';
  }

  return `${parts.day}.${parts.month}.${parts.year}`;
}

function buildDraftDate(value) {
  const parsed = parseBirthDateParts(value);
  const year = parsed.year || DEFAULT_YEAR;
  const month = parsed.month || '01';
  const maxDay = getDaysInMonth(year, month);
  const day = parsed.day
    ? String(Math.min(Number(parsed.day), maxDay)).padStart(2, '0')
    : '01';

  return {
    day,
    month,
    year,
  };
}

function getYearOptions() {
  const currentYear = new Date().getFullYear();
  const startYear = Math.max(currentYear, Number(DEFAULT_YEAR));

  return Array.from({ length: startYear - MIN_YEAR + 1 }, (_, index) =>
    String(startYear - index),
  );
}

function getDayOptions(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  return DAY_OPTIONS.slice(0, daysInMonth);
}

function getDaysInMonth(year, month) {
  const normalizedYear = Number(year) || Number(DEFAULT_YEAR);
  const normalizedMonth = Number(month) || 1;
  return new Date(normalizedYear, normalizedMonth, 0).getDate();
}

function getPickerColumnStyle(name) {
  if (name === 'year') {
    return {
      flex: '1.35 1 0%',
    };
  }

  return {
    flex: '0.9 1 0%',
  };
}

function getBirthDatePickerHint(language) {
  if (language === 'uk') {
    return 'Оберіть день, місяць і рік';
  }

  if (language === 'cs') {
    return 'Zvolte den, měsíc a rok';
  }

  return 'Choose day, month, and year';
}

function getDatePartLabel(language, part) {
  const labels = {
    uk: {
      day: 'День',
      month: 'Місяць',
      year: 'Рік',
    },
    cs: {
      day: 'Den',
      month: 'Měsíc',
      year: 'Rok',
    },
    en: {
      day: 'Day',
      month: 'Month',
      year: 'Year',
    },
  };

  return (labels[language] || labels.en)[part];
}
