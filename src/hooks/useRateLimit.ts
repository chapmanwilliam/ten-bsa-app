'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export function useRateLimit() {
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  // Countdown timer
  useEffect(() => {
    if (lockoutUntil === null) return;

    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsRemaining(0);
        setLockoutUntil(null);
        setFailedAttempts(0);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setSecondsRemaining(remaining);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutUntil]);

  const recordFailure = useCallback(() => {
    setFailedAttempts((prev) => {
      const next = prev + 1;
      if (next >= MAX_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_SECONDS * 1000);
      }
      return next;
    });
  }, []);

  const resetAttempts = useCallback(() => {
    setFailedAttempts(0);
    setLockoutUntil(null);
    setSecondsRemaining(0);
  }, []);

  return {
    isLockedOut,
    secondsRemaining,
    failedAttempts,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failedAttempts),
    recordFailure,
    resetAttempts,
  };
}
