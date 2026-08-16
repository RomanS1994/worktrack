export function SvgIcon({ name, className = '', title, ...props }) {
  if (!name) {
    return null;
  }

  const ariaProps = title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': 'true' };

  return (
    <svg className={className.trim()} focusable="false" {...ariaProps} {...props}>
      <use href={`#icon-${name}`} />
    </svg>
  );
}
