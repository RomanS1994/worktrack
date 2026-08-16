import { useI18n } from '@shared/app/i18n/useI18n.js';
import './TaxInfoIncomeCalendar.css';

const WEEKDAYS = {
  uk: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  cs: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
};

function getCalendarCells(date, days) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const dayMap = new Map(days.map(day => [day.day, day]));
  const cells = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push({ id: `previous-${index}`, muted: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      id: `day-${day}`,
      ...dayMap.get(day),
      day,
    });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 35) {
    cells.push({
      id: `next-${nextDay}`,
      day: nextDay,
      muted: true,
    });
    nextDay += 1;
  }

  return cells;
}

export function TaxInfoIncomeCalendar({
  date,
  days,
  selectedDay,
  selectedDayDetail,
  onSelectDay,
}) {
  const { language, t } = useI18n();
  const weekDays = WEEKDAYS[language] || WEEKDAYS.uk;
  const cells = getCalendarCells(date, days);
  const selectedDaySummary = selectedDayDetail
    ? t('settings.taxInfo.selectedDaySummary', {
        day: selectedDay,
        amount: selectedDayDetail.amountLabel,
        trips: selectedDayDetail.trips,
      })
    : t('settings.taxInfo.calendarHint');

  return (
    <section className="screenCard taxInfoCalendar">
      <div className="compactHeader">
        <h2>{t('settings.taxInfo.calendarTitle')}</h2>
      </div>

      <div className="taxInfoCalendar-grid" aria-label={t('settings.taxInfo.calendarTitle')}>
        {weekDays.map(day => (
          <span className="taxInfoCalendar-weekday" key={day}>
            {day}
          </span>
        ))}

        {cells.map(cell => {
          const dots = Array.from({ length: cell.dots || 0 });

          return (
            <button
              className={[
                'taxInfoCalendar-day',
                cell.muted ? 'is-muted' : '',
                cell.day === selectedDay && !cell.muted ? 'is-selected' : '',
                cell.tone === 'green' ? 'is-green' : '',
              ].filter(Boolean).join(' ')}
              disabled={cell.muted}
              key={cell.id}
              onClick={() => {
                if (!cell.muted) {
                  onSelectDay(cell.day);
                }
              }}
              type="button"
            >
              <span className="taxInfoCalendar-dayNumber">{cell.day}</span>
              {cell.amountLabel ? <span className="taxInfoCalendar-amount">{cell.amountLabel}</span> : null}
              {dots.length ? (
                <span className="taxInfoCalendar-dots" aria-hidden="true">
                  {dots.map((_, index) => (
                    <span key={`${cell.id}-dot-${index}`} />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="taxInfoCalendar-note">
        <span aria-hidden="true">i</span>
        <p>{selectedDaySummary}</p>
      </div>
    </section>
  );
}
