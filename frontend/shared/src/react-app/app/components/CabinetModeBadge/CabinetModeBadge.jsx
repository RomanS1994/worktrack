import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { baseApi } from '../../api/baseApi.js';
import { useI18n } from '../../i18n/useI18n.js';
import { hasManagerAccess } from '../../../features/auth/authAccess.js';
import { selectUser } from '../../../features/auth/authSlice.js';
import { setCabinetMode, useCabinetMode } from '../../../features/auth/cabinetMode.js';
import './CabinetModeBadge.css';

const COPY = {
  uk: {
    manager: 'Менеджер',
    employee: 'Працівник',
    title: 'Режим роботи',
    close: 'Закрити',
    managerCopy: 'Команда, табель, погодження та фінанси',
    employeeCopy: 'Мої години, зарплата та фактури',
  },
  cs: {
    manager: 'Manažer',
    employee: 'Pracovník',
    title: 'Pracovní režim',
    close: 'Zavřít',
    managerCopy: 'Tým, výkazy, schválení a finance',
    employeeCopy: 'Moje hodiny, mzda a faktury',
  },
  en: {
    manager: 'Manager',
    employee: 'Employee',
    title: 'Work mode',
    close: 'Close',
    managerCopy: 'Team, timesheets, approvals and finances',
    employeeCopy: 'My hours, salary and invoices',
  },
};

export function CabinetModeBadge() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const { language } = useI18n();
  const mode = useCabinetMode(user);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const copy = COPY[language] || COPY.uk;

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!hasManagerAccess(user)) return null;

  function selectMode(nextMode) {
    if (nextMode === mode) {
      setOpen(false);
      return;
    }
    if (!setCabinetMode(nextMode, user)) return;
    dispatch(baseApi.util.resetApiState());
    setOpen(false);
    navigate('/', { replace: true });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`cabinetModeBadge is-${mode}`}
        aria-label={`${copy.title}: ${copy[mode]}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="cabinetModeBadge-dot" aria-hidden="true" />
        <strong>{copy[mode]}</strong>
        <span className="cabinetModeBadge-chevron" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="cabinetModeSwitcherLayer" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="cabinetModeSwitcher" role="dialog" aria-modal="true" aria-labelledby="cabinet-mode-title">
            <header className="cabinetModeSwitcher-header">
              <strong id="cabinet-mode-title">{copy.title}</strong>
              <button type="button" className="cabinetModeSwitcher-close" aria-label={copy.close} onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="cabinetModeSwitcher-options">
              {[
                ['manager', copy.manager, copy.managerCopy],
                ['employee', copy.employee, copy.employeeCopy],
              ].map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  className={`cabinetModeOption${mode === value ? ' is-active' : ''}`}
                  aria-pressed={mode === value}
                  onClick={() => selectMode(value)}
                >
                  <span className={`cabinetModeOption-dot is-${value}`} aria-hidden="true" />
                  <span className="cabinetModeOption-copy">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="cabinetModeOption-check" aria-hidden="true">{mode === value ? '✓' : '›'}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
