import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './HoursPage.css';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HoursPage() {
  return (
    <section className="hoursPage pageStack">
      <header className="hoursHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Work entries</p>
          <h1>Hours</h1>
          <p>0 hours this week</p>
        </div>
      </header>

      <section className="hoursWeek screenCard">
        <div className="compactHeader">
          <h2>Current week</h2>
          <p>Draft entries will appear here.</p>
        </div>

        <div className="hoursWeekGrid" aria-label="Current week hours">
          {WEEK_DAYS.map(day => (
            <article className="hoursDay" key={day}>
              <span>{day}</span>
              <strong>0 h</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="hoursEmptyState">
        <span className="hoursEmptyState-icon" aria-hidden="true">
          <SvgIcon name="clock" />
        </span>
        <div>
          <h2>No draft entries</h2>
          <p>This week has no saved hours.</p>
        </div>
      </section>
    </section>
  );
}
