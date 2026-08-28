export function SvgIcon({ name, className = '', title, ...props }) {
  if (!name) {
    return null;
  }

  const ariaProps = title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': 'true' };

  if (name === 'settings') {
    return (
      <svg className={className.trim()} viewBox="0 0 24 24" focusable="false" {...ariaProps} {...props}>
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19.1 13.6c.08-.52.08-1.08 0-1.6l1.72-1.34-1.8-3.12-2.04.82a7.75 7.75 0 0 0-1.38-.8L15.3 5.4h-3.6l-.3 2.16c-.5.2-.96.47-1.38.8l-2.04-.82-1.8 3.12L7.9 12c-.08.52-.08 1.08 0 1.6l-1.72 1.34 1.8 3.12 2.04-.82c.42.33.88.6 1.38.8l.3 2.16h3.6l.3-2.16c.5-.2.96-.47 1.38-.8l2.04.82 1.8-3.12-1.72-1.34Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className={className.trim()} focusable="false" {...ariaProps} {...props}>
      <use href={`#icon-${name}`} />
    </svg>
  );
}
