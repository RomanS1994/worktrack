import { hasEmployeeAccess, hasManagerAccess } from './authAccess.js';

const STORAGE_KEY = 'worktrack.activeCabinet';

function readStoredMode() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function getCabinetMode(user) {
  const canManage = hasManagerAccess(user);
  const canWork = hasEmployeeAccess(user);
  const stored = readStoredMode();

  if (stored === 'manager' && canManage) return 'manager';
  if (stored === 'employee' && canWork) return 'employee';
  return canManage ? 'manager' : 'employee';
}

export function setCabinetMode(mode, user) {
  const normalized = mode === 'manager' ? 'manager' : 'employee';
  const allowed = normalized === 'manager' ? hasManagerAccess(user) : hasEmployeeAccess(user);
  if (!allowed) return false;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Storage is optional; navigation still works for the current render.
    }
  }
  return true;
}

export function isManagerCabinet(user) {
  return hasManagerAccess(user) && getCabinetMode(user) === 'manager';
}
