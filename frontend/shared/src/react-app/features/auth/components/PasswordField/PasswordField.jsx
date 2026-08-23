import { useEffect, useState } from 'react';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './PasswordField.css';

function EyeIcon() {
  return <SvgIcon name="eye" />;
}

function EyeOffIcon() {
  return <SvgIcon name="eye-off" />;
}

export function PasswordField({
  label,
  value,
  onChange,
  onInput,
  autoComplete = 'current-password',
  name = 'password',
  showPasswordLabel,
  hidePasswordLabel,
}) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const hasValue = String(value || '').trim().length > 0;
  const showLabel = showPasswordLabel || t('auth.showPassword');
  const hideLabel = hidePasswordLabel || t('auth.hidePassword');

  useEffect(() => {
    if (!hasValue && isVisible) {
      setIsVisible(false);
    }
  }, [hasValue, isVisible]);

  return (
    <div className="passwordField">
      <span className="passwordField-label">{label}</span>
      <div className="passwordField-control">
        <input
          name={name}
          autoComplete={autoComplete}
          spellCheck={false}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onInput={onInput}
        />
        {hasValue ? (
          <button
            className="passwordField-toggle"
            type="button"
            aria-label={isVisible ? hideLabel : showLabel}
            aria-pressed={isVisible}
            onClick={() => setIsVisible(next => !next)}
          >
            {isVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
