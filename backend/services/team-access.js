export const TEAM_FEATURE_PLAN_ID = 'plan-100';

export function hasTeamFeatureAccess(user) {
  const planId = user?.subscription?.planId || user?.subscription?.plan?.id || '';
  const status = user?.subscription?.status || '';

  return planId === TEAM_FEATURE_PLAN_ID && (!status || status === 'active' || status === 'trial');
}

export function requireTeamFeatureAccess(user) {
  if (!hasTeamFeatureAccess(user)) {
    throw new Error('Platinum plan is required to manage teams');
  }
}

