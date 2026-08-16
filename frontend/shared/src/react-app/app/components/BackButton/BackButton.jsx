import { Link } from 'react-router-dom';

import { useI18n } from '../../i18n/useI18n.js';
import { SvgIcon } from '../SvgIcon/SvgIcon.jsx';
import './BackButton.css';

export function BackButton({
  children,
  className = '',
  label,
  to,
  type = 'button',
  ...props
}) {
  const { t } = useI18n();
  const content = label || children || t('common.back');
  const buttonClassName = ['appBackButton', className].filter(Boolean).join(' ');

  const inner = (
    <>
      <SvgIcon className="appBackButton-icon" name="back" />
      <span className="appBackButton-label">{content}</span>
    </>
  );

  if (to) {
    return (
      <Link className={buttonClassName} to={to} {...props}>
        {inner}
      </Link>
    );
  }

  return (
    <button className={buttonClassName} type={type} {...props}>
      {inner}
    </button>
  );
}
