import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './EmployeesPage.css';

export function EmployeesPage() {
  return (
    <section className="employeesPage pageStack">
      <header className="employeesHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Team</p>
          <h1>Employees</h1>
          <p>0 active employees</p>
        </div>
      </header>

      <section className="employeesPanel screenCard">
        <div className="compactHeader">
          <h2>Employee list</h2>
          <p>No employees added yet.</p>
        </div>

        <div className="employeesEmpty">
          <span aria-hidden="true">
            <SvgIcon name="accounts" />
          </span>
          <strong>No employees yet</strong>
        </div>
      </section>
    </section>
  );
}
