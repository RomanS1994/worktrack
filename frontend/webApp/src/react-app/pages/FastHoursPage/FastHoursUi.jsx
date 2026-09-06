import { useEffect, useRef } from 'react';

export function UiIcon({ type }) {
  if (type === 'building') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4.8c0-.7.5-1.3 1.2-1.5l7-2.1c.9-.3 1.8.4 1.8 1.3V21M15 8h4c.6 0 1 .4 1 1v12M3 21h19M8 7h3M8 11h3M8 15h3M8 19h3M17 12h1M17 16h1"/></svg>;
  if (type === 'lunch') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v7M8 3v7M3 6h7M6.5 10v11M16 3v18M16 3c3 2 4 5 4 8h-4"/></svg>;
  if (type === 'calendar') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM7 2v4M17 2v4M3 9h18"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>;
}

export function TimeField({ value, onClick, disabled }) {
  return <button className="timeField" type="button" disabled={disabled} onClick={onClick}><span className="timeFieldIcon"><UiIcon type="clock"/></span><strong>{value}</strong><span className="timeFieldChevron">⌄</span></button>;
}

export function SummaryStat({ tone, icon, label, value }) {
  return <div className={`shiftSummaryStat is-${tone}`}><span className="shiftSummaryIcon"><UiIcon type={icon}/></span><span className="shiftSummaryText"><small>{label}</small><strong>{value}</strong></span></div>;
}

export function WheelColumn({ values, value, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current?.querySelector(`[data-value="${value}"]`);
    element?.scrollIntoView({ block: 'center' });
  }, [value]);

  return <div className="timeWheel"><span className="timeWheelLabel">{label}</span><div className="timeWheelList" ref={ref}>{values.map(item => <button type="button" data-value={item} className={item === value ? 'is-active' : ''} onClick={() => onChange(item)} key={item}>{item}</button>)}</div></div>;
}
