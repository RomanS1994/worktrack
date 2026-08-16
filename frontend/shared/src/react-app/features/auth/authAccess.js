export function hasManagerAccess(user) {
  return user?.role === 'MANAGER';
}
