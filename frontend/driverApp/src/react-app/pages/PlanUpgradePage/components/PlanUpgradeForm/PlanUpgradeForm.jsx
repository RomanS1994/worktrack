import { Fragment } from 'react';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { RequestLoader, RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';

import { usePlanUpgradeForm } from './usePlanUpgradeForm.js';
import './PlanUpgradeForm.css';

export function PlanUpgradeForm() {
  const {
    availablePlans,
    error,
    hasSelectablePlans,
    handleSubmit,
    isLoading,
    isPlansError,
    isPlansLoading,
    loadingLabel,
    message,
    pendingPlanId,
    selectPlan,
    selectedPlanId,
    submitLabel,
    getPlanMeta,
    t,
    title,
  } = usePlanUpgradeForm();

  if (pendingPlanId) {
    return (
      <section className="planUpgradeForm planUpgradeForm-state">
        <div className="compactHeader">
          <h2>{t('account.planUpgradePendingTitle')}</h2>
          <p>{t('account.planUpgradePendingCopy')}</p>
        </div>
      </section>
    );
  }

  if (isPlansLoading && !availablePlans.length) {
    return (
      <section className="planUpgradeForm planUpgradeForm-state">
        <div className="compactHeader">
          <h2>{title}</h2>
        </div>
        <RequestLoadingState label={t('home.loadingPlans')} />
      </section>
    );
  }

  if (isPlansError) {
    return (
      <section className="planUpgradeForm planUpgradeForm-state">
        <div className="compactHeader">
          <h2>{title}</h2>
          <p>{t('home.failedToLoadPlans')}</p>
        </div>
      </section>
    );
  }

  if (!availablePlans.length) {
    return (
      <section className="planUpgradeForm planUpgradeForm-state">
        <div className="compactHeader">
          <h2>{t('account.planUpgradeUnavailableTitle')}</h2>
          <p>{t('account.planUpgradeUnavailableCopy')}</p>
        </div>
      </section>
    );
  }

  return (
    <form className="planUpgradeForm" onSubmit={handleSubmit}>
      <div className="planUpgradeForm-plans" aria-label={t('auth.plan')}>
        {availablePlans.map(plan => {
          const meta = getPlanMeta(plan);
          const selected = plan.id === selectedPlanId;

          return (
            <button
              key={plan.id}
              type="button"
              className={`planUpgradeForm-plan planUpgradeForm-plan--${meta.variant} ${
                selected ? 'is-selected' : ''
              } ${meta.isCurrent ? 'is-current' : ''} ${meta.badgeLabel ? 'has-badge' : ''}`}
              aria-pressed={selected}
              disabled={isPlansLoading}
              onClick={() => selectPlan(plan.id)}
            >
              {meta.badgeLabel ? (
                <span className="planUpgradeForm-badge">
                  <span className="planUpgradeForm-badgeIcon" aria-hidden="true">
                    <SvgIcon name={meta.badgeIconName} />
                  </span>
                  <span>{meta.badgeLabel}</span>
                </span>
              ) : null}

              <span className="planUpgradeForm-tierIcon" aria-hidden="true">
                <SvgIcon name={meta.iconName} />
              </span>

              <span className="planUpgradeForm-planBody">
                <span className="planUpgradeForm-planName">{plan.name || plan.id}</span>
                <span className="planUpgradeForm-planDescription">{meta.descriptionLabel}</span>
                <span className="planUpgradeForm-planMeta">
                  <span className="planUpgradeForm-chip">
                    <span className="planUpgradeForm-chipIcon" aria-hidden="true">
                      <SvgIcon name="token" />
                    </span>
                    <span>{meta.limitLabel}</span>
                  </span>
                  {meta.featureChips.map(feature => (
                    <Fragment key={feature.key}>
                      <span className="planUpgradeForm-separator" aria-hidden="true" />
                      <span className="planUpgradeForm-chip">
                        <span className="planUpgradeForm-chipIcon" aria-hidden="true">
                          <SvgIcon name={feature.iconName} />
                        </span>
                        <span>{feature.label}</span>
                      </span>
                    </Fragment>
                  ))}
                  <span className="planUpgradeForm-separator" aria-hidden="true" />
                  <span className="planUpgradeForm-chip">
                    <span className="planUpgradeForm-chipIcon" aria-hidden="true">
                      <SvgIcon name="refresh-cw" />
                    </span>
                    <span>{meta.modeLabel}</span>
                  </span>
                </span>
              </span>

              <span className="planUpgradeForm-planAside">
                <span className="planUpgradeForm-planPrice">
                  {meta.originalPriceLabel || meta.discountLabel ? (
                    <span className="planUpgradeForm-planPriceTop">
                      {meta.originalPriceLabel ? (
                        <span className="planUpgradeForm-planOriginalPrice">
                          {meta.originalPriceLabel}
                        </span>
                      ) : null}
                      {meta.discountLabel ? (
                        <span className="planUpgradeForm-discountBadge">
                          {meta.discountLabel}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <span className="planUpgradeForm-planPriceAmount">{meta.priceLabel}</span>
                  <span className="planUpgradeForm-planPricePeriod">/ {meta.monthLabel}</span>
                </span>
                <span className="planUpgradeForm-planAction">
                  {meta.isCurrent ? (
                    <span className="planUpgradeForm-planActionIcon" aria-hidden="true">
                      <SvgIcon name="check-circle" />
                    </span>
                  ) : null}
                  <span>{meta.actionLabel}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {message ? <p className="planUpgradeForm-message">{message}</p> : null}
      {error ? <p className="planUpgradeForm-error">{error}</p> : null}

      <button
        className="planUpgradeForm-button"
        type="submit"
        disabled={isLoading || !hasSelectablePlans}
      >
        {isLoading ? (
          <RequestLoader inline size="sm" label={loadingLabel} />
        ) : (
          <>
            <span className="planUpgradeForm-buttonIcon" aria-hidden="true">
              <SvgIcon name="mail" />
            </span>
            <span>{submitLabel}</span>
          </>
        )}
      </button>

      <p className="planUpgradeForm-secureNote">
        <span className="planUpgradeForm-secureNoteIcon" aria-hidden="true">
          <SvgIcon name="lock-keyhole" />
        </span>
        <span>{t('settings.planUpgrade.secureNote')}</span>
      </p>
    </form>
  );
}
