import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { isSessionExpired } from './generationSessionSlice.js';
import {
  selectGenerationSession,
  startSession,
} from './generationSessionSlice.js';
import {
  clearGenerationSession,
  loadGenerationSession,
  saveGenerationSession,
} from './generationSessionStorage.js';

export function useGenerationSessionPersistence() {
  const dispatch = useDispatch();
  const generationSession = useSelector(selectGenerationSession);
  const isReady = useRef(false);
  const [readyState, setReadyState] = useState(false);

  useEffect(() => {
    const savedSession = loadGenerationSession();

    if (savedSession?.accessGranted && !isSessionExpired(savedSession.expiresAt)) {
      dispatch(startSession(savedSession));
    } else if (savedSession?.accessGranted || savedSession?.orderId) {
      clearGenerationSession();
    }

    isReady.current = true;
    setReadyState(true);
  }, [dispatch]);

  useEffect(() => {
    if (!isReady.current) return;

    if (!generationSession.accessGranted) {
      clearGenerationSession();
      return;
    }

    saveGenerationSession(generationSession);
  }, [generationSession]);

  return readyState;
}
