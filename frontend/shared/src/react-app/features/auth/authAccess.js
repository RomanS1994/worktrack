export function hasManagerAccess(user) {
  const role = typeof user === 'string' ? user : user?.activeMembership?.role || user?.role;
  return role === 'MANAGER';
}

export function hasEmployeeAccess(user) {
  const role = typeof user === 'string' ? user : user?.activeMembership?.role || user?.role;
  return role === 'EMPLOYEE';
}
