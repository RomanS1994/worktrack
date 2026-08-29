const SPECIAL_ICONS = {
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.1 13.6c.08-.52.08-1.08 0-1.6l1.72-1.34-1.8-3.12-2.04.82a7.75 7.75 0 0 0-1.38-.8L15.3 5.4h-3.6l-.3 2.16c-.5.2-.96.47-1.38.8l-2.04-.82-1.8 3.12L7.9 12c-.08.52-.08 1.08 0 1.6l-1.72 1.34 1.8 3.12 2.04-.82c.42.33.88.6 1.38.8l.3 2.16h3.6l.3-2.16c.5-.2.96-.47 1.38-.8l2.04.82 1.8-3.12-1.72-1.34Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  building: (
    <>
      <path d="M6 20V5.2c0-.7.5-1.2 1.2-1.2h7.6c.7 0 1.2.5 1.2 1.2V20M4 20h16M9 8h2M13 8h2M9 11.5h2M13 11.5h2M9 15h2M13 15h2M10.5 20v-2.5h3V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.8h12v16.4l-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25-2 1.25V3.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 8h6M9 11.5h6M9 15h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 12h15M12 4c2.1 2.2 3.2 4.9 3.2 8S14.1 17.8 12 20M12 4c-2.1 2.2-3.2 4.9-3.2 8S9.9 17.8 12 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10" width="13" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M9 7V4.5h6V7M7.2 7l.7 12h8.2l.7-12M10 10.5v5M14 10.5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10M14.5 8.5 18 12l-3.5 3.5M9 12h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export function SvgIcon({ name, className = '', title, ...props }) {
  if (!name) return null;

  const ariaProps = title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': 'true' };

  const specialIcon = SPECIAL_ICONS[name];
  if (specialIcon) {
    return (
      <svg className={className.trim()} viewBox="0 0 24 24" focusable="false" {...ariaProps} {...props}>
        {specialIcon}
      </svg>
    );
  }

  return (
    <svg className={className.trim()} focusable="false" {...ariaProps} {...props}>
      <use href={`#icon-${name}`} />
    </svg>
  );
}
