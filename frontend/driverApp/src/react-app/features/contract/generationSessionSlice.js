import { createSlice } from '@reduxjs/toolkit';

const GENERATION_WINDOW_MS = 10 * 60 * 1000;

export function getGenerationWindowMs() {
  return GENERATION_WINDOW_MS;
}

export function isSessionExpired(expiresAt) {
  if (!expiresAt) {
    return false;
  }

  const expiresTime = Date.parse(expiresAt);
  if (!Number.isFinite(expiresTime)) {
    return false;
  }

  return expiresTime <= Date.now();
}

export function hasGenerationSession(session) {
  if (!session || typeof session !== 'object') {
    return false;
  }

  return Boolean(session.accessGranted) && !isSessionExpired(session.expiresAt);
}

const generationSessionSlice = createSlice({
  name: 'generationSession',
  initialState: {
    orderId: '',
    orderNumber: '',
    documentType: '',
    expiresAt: '',
    createdAt: '',
    accessGranted: false,
    isGateOpen: false,
  },
  reducers: {
    openGate(state) {
      state.isGateOpen = true;
    },
    closeGate(state) {
      state.isGateOpen = false;
    },
    startSession(state, action) {
      state.orderId = action.payload.orderId || '';
      state.orderNumber = action.payload.orderNumber || '';
      state.documentType = action.payload.documentType || '';
      state.expiresAt = action.payload.expiresAt || '';
      state.createdAt = action.payload.createdAt || '';
      state.accessGranted = Boolean(action.payload.accessGranted);
      state.isGateOpen = false;
    },
    clearSession(state) {
      state.orderId = '';
      state.orderNumber = '';
      state.documentType = '';
      state.expiresAt = '';
      state.createdAt = '';
      state.accessGranted = false;
      state.isGateOpen = false;
    },
  },
});

export const {
  openGate,
  closeGate,
  startSession,
  clearSession,
} = generationSessionSlice.actions;

export const selectGenerationSession = state => state.generationSession;

export default generationSessionSlice.reducer;
