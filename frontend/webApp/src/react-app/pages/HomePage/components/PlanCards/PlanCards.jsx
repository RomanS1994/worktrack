import { useI18n } from '@shared/app/i18n/useI18n.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useGetPlansQuery } from '@shared/features/plans/plansApi.js';
import { PlanCard } from '../PlanCard/PlanCard.jsx';
import './PlanCards.css';

export function PlanCards({ selectedPlanId, onPlanSelect }) {
  const { data, isLoading, isError } = useGetPlansQuery();
  const { t } = useI18n();
  const plans = data?.plans || [];

  return (
    <section className="planCardsSection" aria-label={t('app.settings')}>
      {isLoading ? <RequestLoadingState className="statusNote" label={t('home.loadingPlans')} /> : null}
      {isError ? <p className="statusNote is-error">{t('home.failedToLoadPlans')}</p> : null}

      {!isLoading && !isError && plans.length ? (
        <div className="planCardsGrid">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={plan.id === selectedPlanId}
              onClick={() => onPlanSelect?.(plan.id)}
            />
          ))}
        </div>
      ) : null}

      {!isLoading && !isError && !plans.length ? (
        <p className="statusNote">{t('home.noPlans')}</p>
      ) : null}
    </section>
  );
}
