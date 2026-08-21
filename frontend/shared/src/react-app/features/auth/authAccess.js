function getActiveMembership(user) {
  if (!user || typeof user === 'string') return null;

  const membership = user.activeMembership || null;
  if (!membership || membership.status !== 'ACTIVE' || !membership.companyId) {
    return null;
  }

  return membership;
}

export function hasActiveCompanyAccess(user) {
  return Boolean(getActiveMembership(user));
}

export function hasManagerAccess(user) {
  if (typeof user === 'string') return user === 'MANAGER';
  return getActiveMembership(user)?.role === 'MANAGER';
}

export function hasEmployeeAccess(user) {
  if (typeof user === 'string') return user === 'EMPLOYEE';
  return getActiveMembership(user)?.role === 'EMPLOYEE';
}
