import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigation } from 'react-router-dom';

import { baseApi } from '../../api/baseApi.js';
import './RequestLoader.css';

function getPendingEntriesCount(entries = {}) {
  return Object.values(entries).reduce((count, entry) => {
    return entry?.status === 'pending' ? count + 1 : count;
  }, 0);
}

function selectPendingRequestCount(state) {
  const apiState = state?.[baseApi.reducerPath] || {};

  return (
    getPendingEntriesCount(apiState.queries) +
    getPendingEntriesCount(apiState.mutations)
  );
}

function useRouteTransitionBusy(duration = 260) {
  const location = useLocation();
  const previousKeyRef = useRef(location.key);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (previousKeyRef.current === location.key) {
      return undefined;
    }

    previousKeyRef.current = location.key;
    setIsBusy(true);

    const timer = window.setTimeout(() => {
      setIsBusy(false);
    }, duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [duration, location.key]);

  return isBusy;
}

export function RequestLoader({
  className = '',
  inline = false,
  label = 'Loading...',
  size = 'md',
}) {
  const classNames = [
    'requestLoader',
    `requestLoader--${size}`,
    inline ? 'requestLoader--inline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classNames} role="status" aria-live="polite">
      <span className="requestLoader-orbit" aria-hidden="true">
        <span className="requestLoader-core" />
      </span>
      <span className="requestLoader-label">{label}</span>
    </span>
  );
}

export function RequestLoadingState({ className = '', label = 'Loading...' }) {
  return (
    <div className={`requestLoadingState ${className}`.trim()}>
      <RequestLoader label={label} />
    </div>
  );
}

export function GlobalRequestLoader() {
  const pendingRequestCount = useSelector(selectPendingRequestCount);
  const navigation = useNavigation();
  const routeTransitionBusy = useRouteTransitionBusy();
  const isBusy =
    pendingRequestCount > 0 ||
    navigation.state !== 'idle' ||
    routeTransitionBusy;
  const [isVisible, setIsVisible] = useState(isBusy);

  useEffect(() => {
    if (isBusy) {
      setIsVisible(true);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIsVisible(false);
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isBusy]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`globalRequestLoader ${isBusy ? 'is-active' : 'is-complete'}`}
      aria-hidden="true"
    >
      <span className="globalRequestLoader-track">
        <span className="globalRequestLoader-bar" />
      </span>
    </div>
  );
}
