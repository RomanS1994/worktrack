import { useSyncExternalStore } from 'react';
import { hasEmployeeAccess, hasManagerAccess } from './authAccess.js';

const STORAGE_KEY = 'worktrack.activeCabinet';
const listeners = new Set();

function readStoredMode() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function subscribe(listener) {
  listeners.add(listener);

  if (typeof window === 'undefined') {
    return () => listeners.delete(listener);
  }

  const handleStorage = event => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

function emitChange() {
  for (const listener of listeners) listener();
}

function resolveCabinetMode(user, stored) {
  const canManage = hasManagerAccess(user);
  const canWork = hasEmployeeAccess(user);

  if (stored === 'manager' && canManage) return 'manager';
  if (stored === 'employee' && canWork) return 'employee';
  return canManage ? 'manager' : 'employee';
}

export function getCabinetMode(user) {
  return resolveCabinetMode(user, readStoredMode());
}

export function useCabinetMode(user) {
  const stored = useSyncExternalStore(subscribe, readStoredMode, () => '');
  return resolveCabinetMode(user, stored);
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

  emitChange();
  return true;
}

export function isManagerCabinet(user) {
  return hasManagerAccess(user) && getCabinetMode(user) === 'manager';
}
