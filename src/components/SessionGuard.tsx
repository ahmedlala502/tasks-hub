import { useCallback, useEffect, useRef } from 'react';
import { useLocalData } from './LocalDataContext';
import { addToast } from '../lib/toast';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click', 'mousemove'] as const;

export default function SessionGuard() {
  const { auth, lock, settings } = useLocalData();
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockMinutes = settings.sessionLockMinutes || 60;
  const lockMs = lockMinutes * 60 * 1000;
  const warningMs = lockMs - 60_000; // Warn 1 minute before lock
  const warnedRef = useRef(false);

  const doLock = useCallback(() => {
    if (auth.isAuthenticated && !auth.isLocked) {
      lock();
      addToast('Session locked due to inactivity. Please sign in again.', 'warning', 6000);
    }
  }, [auth.isAuthenticated, auth.isLocked, lock]);

  const showWarning = useCallback(() => {
    if (!warnedRef.current && auth.isAuthenticated && !auth.isLocked) {
      warnedRef.current = true;
      addToast('Your session will lock in 1 minute due to inactivity. Move your mouse to stay active.', 'warning', 8000);
    }
  }, [auth.isAuthenticated, auth.isLocked]);

  const resetTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warnedRef.current = false;

    if (!auth.isAuthenticated || auth.isLocked) return;

    if (warningMs > 0) {
      warningTimerRef.current = setTimeout(showWarning, warningMs);
    }
    lockTimerRef.current = setTimeout(doLock, lockMs);
  }, [auth.isAuthenticated, auth.isLocked, doLock, showWarning, lockMs, warningMs]);

  useEffect(() => {
    resetTimer();
    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, handler, { passive: true }));
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, handler));
    };
  }, [resetTimer]);

  // Check session expiration periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (auth.expiresAt && Date.now() > auth.expiresAt) {
        doLock();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [auth.expiresAt, doLock]);

  return null;
}
