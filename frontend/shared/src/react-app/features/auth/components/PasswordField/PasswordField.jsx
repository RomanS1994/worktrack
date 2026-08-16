import { useEffect, useState } from 'react';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
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
  showPasswordLabel = 'Show password',
  hidePasswordLabel = 'Hide password',
}) {
  const [isVisible, setIsVisible] = useState(false);
  const hasValue = String(value || '').trim().length > 0;

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
            aria-label={isVisible ? hidePasswordLabel : showPasswordLabel}
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
