import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useRequestSubscriptionUpgradeMutation } from '@shared/features/auth/authApi.js';
import { selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import { useGetPlansQuery } from '@shared/features/plans/plansApi.js';

function getPlanValue(plan) {
  const price = Number(plan?.priceCzk || 0);
  const limit = Number(plan?.monthlyGenerationLimit || 0);

  return price * 100000 + limit;
}

function getPlanRank(plan) {
  const variant = getPlanVariant(plan);

  if (variant === 'silver') return 1;
  if (variant === 'gold') return 2;
  if (variant === 'platinum') return 3;
  if (variant === 'free') return 4;

  return 5;
}

function getSortedPlans(plans) {
  return [...plans].sort((first, second) => {
    const rankDiff = getPlanRank(first) - getPlanRank(second);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    return getPlanValue(first) - getPlanValue(second);
  });
}

function getPlanVariant(plan) {
  const planName = String(plan?.id || plan?.slug || plan?.name || '').toLowerCase();
  const limit = Number(plan?.monthlyGenerationLimit || 0);

  if (planName.includes('free') || planName.includes('trial') || limit <= 100) {
    return 'free';
  }

  if (planName.includes('silver') || planName.includes('starter') || limit <= 300) {
    return 'silver';
  }

  if (planName.includes('gold') || planName.includes('growth') || limit <= 500) {
    return 'gold';
  }

  if (planName.includes('platinum') || planName.includes('scale') || limit > 500) {
    return 'platinum';
  }

  return 'silver';
}

function getPlanIconName(variant) {
  if (variant === 'free') {
    return 'gift';
  }

  if (variant === 'gold') {
    return 'gem';
  }

  if (variant === 'platinum') {
    return 'crown';
  }

  return 'star';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('cs-CZ');
}

function getDiscountPercent(plan, originalPrice, price) {
  const configuredDiscount = Number(plan?.discountPercent || 0);

  if (configuredDiscount > 0) {
    return Math.min(100, Math.round(configuredDiscount));
  }

  if (originalPrice > price && originalPrice > 0) {
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  return 0;
}

function getPlanModeLabel({ direction, isCurrent, t }) {
  if (isCurrent) {
    return t('settings.planUpgrade.autoRenewal');
  }

  if (direction === 'upgrade') {
    return t('account.upgrade');
  }

  if (direction === 'downgrade') {
    return t('settings.planUpgrade.downgrade');
  }

  return t('settings.planUpgrade.changePlan');
}

function getPlanDirection(planValue, currentPlanValue) {
  if (planValue > currentPlanValue) {
    return 'upgrade';
  }

  if (planValue < currentPlanValue) {
    return 'downgrade';
  }

  return 'change';
}

function getPlanActionLabel({ direction, isCurrent, planName, t }) {
  if (isCurrent) {
    return t('settings.planUpgrade.active');
  }

  if (String(planName).toLowerCase() === 'free') {
    return t('settings.planUpgrade.selectFree');
  }

  if (direction === 'upgrade') {
    return t('settings.planUpgrade.upgradeTo', { plan: planName });
  }

  return t('settings.planUpgrade.changeTo', { plan: planName });
}

function getPlanBadgeMeta({ isCurrent, variant, t }) {
  if (isCurrent) {
    return {
      iconName: 'check-circle',
      label: t('settings.planUpgrade.currentPlanBadge'),
    };
  }

  if (variant === 'gold') {
    return {
      iconName: 'star',
      label: t('settings.planUpgrade.popular'),
    };
  }

  return null;
}

function getPlanFeatureChips({ variant, t }) {
  const chips = [];

  if (variant === 'gold' || variant === 'platinum') {
    chips.push({
      iconName: 'invoice',
      key: 'invoices',
      label: t('settings.planUpgrade.invoices'),
    });
  }

  if (variant === 'platinum') {
    chips.push({
      iconName: 'accounts',
      key: 'teams',
      label: t('settings.planUpgrade.teams'),
    });
    chips.push({
      iconName: 'plane',
      key: 'flightTracking',
      label: t('settings.planUpgrade.flightTracking'),
    });
  }

  return chips;
}

export function usePlanUpgradeForm() {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
  const { t } = useI18n();
  const { data, isLoading: isPlansLoading, isError: isPlansError } = useGetPlansQuery();
  const [requestUpgrade, { isLoading }] = useRequestSubscriptionUpgradeMutation();
  const [planId, setPlanId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const plans = data?.plans || [];
  const currentPlanId = user?.subscription?.plan?.id || user?.plan?.id || '';
  const currentPlan =
    plans.find(plan => plan.id === currentPlanId) ||
    user?.subscription?.plan ||
    user?.plan ||
    null;
  const pendingPlanId = user?.subscription?.pendingPlanId || '';
  const currentPlanValue = getPlanValue(currentPlan);
  const availablePlans = useMemo(() => getSortedPlans(plans), [plans]);
  const defaultPlanId = availablePlans.some(plan => plan.id === currentPlanId)
    ? currentPlanId
    : availablePlans[0]?.id || '';
  const selectedPlanId = availablePlans.some(plan => plan.id === planId)
    ? planId
    : defaultPlanId;
  const selectedPlan = availablePlans.find(plan => plan.id === selectedPlanId) || null;
  const isSelectedCurrentFreePlan = Boolean(
    selectedPlan?.id &&
      selectedPlan.id === currentPlanId &&
      Number(selectedPlan.priceCzk || 0) <= 0
  );
  const isSelectedRenewal = Boolean(
    selectedPlan?.id && selectedPlan.id === currentPlanId && Number(selectedPlan.priceCzk || 0) > 0
  );

  const title = t('settings.planUpgrade.title');
  const submitLabel = isSelectedRenewal ? t('auth.requestRenewal') : t('auth.requestPlanChange');
  const loadingLabel = isSelectedRenewal ? t('auth.sendingRenewal') : t('auth.sendingPlanChange');
  const successMessage = isSelectedRenewal ? t('auth.renewalSent') : t('auth.planChangeSent');
  const failureMessage = isSelectedRenewal
    ? t('auth.failedToRequestRenewal')
    : t('auth.failedToRequestPlanChange');

  function selectPlan(nextPlanId) {
    setPlanId(nextPlanId);
    setMessage('');
    setError('');
  }

  function getPlanMeta(plan) {
    const isCurrent = plan.id === currentPlanId;
    const planValue = getPlanValue(plan);
    const direction = getPlanDirection(planValue, currentPlanValue);
    const variant = getPlanVariant(plan);
    const planName = plan.name || plan.id;
    const price = Number(plan.priceCzk || 0);
    const originalPrice = Number(plan.originalPriceCzk || 0);
    const discountPercent = getDiscountPercent(plan, originalPrice, price);
    const limit = Number(plan.monthlyGenerationLimit || 0);
    const badge = getPlanBadgeMeta({ isCurrent, variant, t });

    return {
      variant,
      isCurrent,
      actionLabel: getPlanActionLabel({ direction, isCurrent, planName, t }),
      badgeIconName: badge?.iconName || '',
      badgeLabel: badge?.label || '',
      descriptionLabel: t(`settings.planUpgrade.planDescriptions.${variant}`),
      iconName: getPlanIconName(variant),
      monthLabel: t('settings.planUpgrade.perMonth'),
      modeLabel: getPlanModeLabel({ direction, isCurrent, t }),
      priceLabel: `${formatNumber(price)} CZK`,
      originalPriceLabel:
        originalPrice > price ? `${formatNumber(originalPrice)} CZK` : '',
      discountLabel: discountPercent > 0 ? `-${discountPercent}%` : '',
      limitLabel: t('settings.planUpgrade.planTokensLabel', { count: formatNumber(limit) }),
      featureChips: getPlanFeatureChips({ variant, t }),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!selectedPlanId || isSelectedCurrentFreePlan) {
      setError(t('auth.choosePaidPlan'));
      return;
    }

    try {
      const updatedUser = await requestUpgrade({ planId: selectedPlanId }).unwrap();
      saveSession(token, updatedUser);
      dispatch(setSession({ token, user: updatedUser }));
      setMessage(successMessage);
    } catch {
      setError(failureMessage);
    }
  }

  return {
    availablePlans,
    error,
    handleSubmit,
    isLoading,
    isPlansError,
    isPlansLoading,
    hasSelectablePlans: Boolean(availablePlans.length && !isSelectedCurrentFreePlan),
    loadingLabel,
    message,
    pendingPlanId,
    selectPlan,
    selectedPlanId,
    submitLabel,
    getPlanMeta,
    t,
    title,
  };
}
