import { useI18n } from '@shared/app/i18n/useI18n.js';
import './PlanCard.css';

function getPriceLabel(plan, t) {
  const price = Number(plan.priceCzk || 0);

  return price > 0 ? `${price} CZK` : t('home.free');
}

function getPlanVariant(plan) {
  const planName = String(plan.id || plan.slug || plan.name || '').toLowerCase();
  const limit = Number(plan.monthlyGenerationLimit || 0);

  if (planName.includes('free') || planName.includes('trial')) {
    return 'planCard--free';
  }

  if (
    planName.includes('silver') ||
    planName.includes('starter')
  ) {
    return 'planCard--silver';
  }

  if (
    planName.includes('gold') ||
    planName.includes('growth')
  ) {
    return 'planCard--gold';
  }

  if (
    planName.includes('platinum') ||
    planName.includes('scale')
  ) {
    return 'planCard--platinum';
  }

  if (limit <= 100) {
    return 'planCard--free';
  }

  if (limit <= 300) {
    return 'planCard--silver';
  }

  if (limit <= 500) {
    return 'planCard--gold';
  }

  if (limit > 500) {
    return 'planCard--platinum';
  }

  return 'planCard--silver';
}

function getPlanTokens(plan, t) {
  const limit = Number(plan.monthlyGenerationLimit || 0);
  const pdfCount = Array.isArray(plan.pdfDocuments) ? plan.pdfDocuments.length : 0;
  const variant = getPlanVariant(plan);

  const tokens = [t('contract.planTokensShort', { count: limit }), t('contract.pdfTypes', { count: pdfCount })];

  if (variant === 'planCard--free') {
    tokens.push(t('home.manualUpgrade'));
  } else if (variant === 'planCard--silver') {
    tokens.push(t('home.sharpEntry'));
  } else if (variant === 'planCard--gold') {
    tokens.push(t('home.bestValue'));
  } else if (variant === 'planCard--platinum') {
    tokens.push(t('home.priorityAccess'));
  }

  return tokens;
}

export function PlanCard({ plan, selected = false, onClick }) {
  const { t } = useI18n();
  const tokens = getPlanTokens(plan, t);

  return (
    <button
      type="button"
      className={`planCard ${getPlanVariant(plan)} ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {selected ? <span className="planCard-selectedBadge">{t('common.yes')}</span> : null}
      <div className="planCard-topRow">
        <span className="planCard-tier">{plan.name || '-'}</span>
        <span className="planCard-price">{getPriceLabel(plan, t)}</span>
      </div>
      <div className="planCard-hero">
        <span className="planCard-heroLabel">{t('home.monthlyTokens')}</span>
        <strong className="planCard-heroValue">{plan.monthlyGenerationLimit || '-'}</strong>
      </div>
      <div className="planCard-tokens" aria-label={t('home.planTokens')}>
        {tokens.map(token => (
          <span className="planCard-token" key={token}>
            {token}
          </span>
        ))}
      </div>
      <div className="planCard-footer">
        <span className="planCard-action">{selected ? t('home.selectedPlan') : t('home.choosePlan')}</span>
      </div>
    </button>
  );
}
