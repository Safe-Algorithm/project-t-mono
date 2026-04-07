import { useAuth } from '@/context/UserContext';
import { useEffect, useRef } from 'react';

/** Returns seconds until token expiry (negative if already expired). */
function tokenSecondsRemaining(token: string): number {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (!payload?.exp) return -1;
    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

// Refresh this many seconds before the token actually expires.
const REFRESH_BEFORE_EXPIRY_SECONDS = 90;
// Minimum delay between refresh attempts (prevents thrashing).
const MIN_REFRESH_DELAY_MS = 10_000;

export const useTokenRefresh = () => {
  const { token, refreshToken, logout } = useAuth();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!token) return;

    const scheduleNext = (currentToken: string) => {
      const secondsLeft = tokenSecondsRemaining(currentToken);
      // How long to wait before refreshing: fire REFRESH_BEFORE_EXPIRY_SECONDS before expiry.
      const delayMs = Math.max(
        (secondsLeft - REFRESH_BEFORE_EXPIRY_SECONDS) * 1000,
        MIN_REFRESH_DELAY_MS,
      );

      timerRef.current = setTimeout(async () => {
        const success = await refreshToken();
        if (!success) {
          logout();
        }
        // After a successful refresh the token state changes, which will
        // re-run this effect with the new token and reschedule automatically.
      }, delayMs);
    };

    scheduleNext(token);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [token, refreshToken, logout]);
};
