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
  const membership = getActiveMembership(user);
  const role = typeof user === 'string' ? user : membership?.role;
  if (role !== 'EMPLOYEE' && role !== 'MANAGER') return false;
  return membership?.canAccessEmployeeCabinet !== false;
}
