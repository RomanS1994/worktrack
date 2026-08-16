import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './ApprovalsPage.css';

export function ApprovalsPage() {
  return (
    <section className="approvalsPage pageStack">
      <header className="approvalsHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Review</p>
          <h1>Approvals</h1>
          <p>0 pending submissions</p>
        </div>
      </header>

      <section className="approvalsPanel screenCard">
        <div className="compactHeader">
          <h2>Weekly submissions</h2>
          <p>No submitted weeks yet.</p>
        </div>

        <div className="approvalsStatusRow">
          <span aria-hidden="true">
            <SvgIcon name="check-circle" />
          </span>
          <strong>Review queue is empty</strong>
        </div>
      </section>
    </section>
  );
}
