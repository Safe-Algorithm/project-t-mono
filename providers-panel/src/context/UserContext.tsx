import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import { User } from '@/types/user';
import { setGlobalRefreshToken } from '@/services/api';

/** Decode JWT payload without verification (client-side only — expiry check). */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** Returns seconds until token expiry (negative if already expired). */
function tokenSecondsRemaining(token: string): number {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return -1;
  return payload.exp - Math.floor(Date.now() / 1000);
}

interface UserContextType {
  user: User | null;
  token: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  login: (accessToken: string) => void;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user, isLoading, error } = useUser(token);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'providers_panel',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        localStorage.setItem('provider_access_token', data.access_token);
        return true;
      } else {
        setToken(null);
        localStorage.removeItem('provider_access_token');
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      setToken(null);
      localStorage.removeItem('provider_access_token');
      return false;
    }
  }, []);

  // Register refresh function synchronously so the api layer can use it
  // before the first useEffect fires (avoids race on initial API calls).
  setGlobalRefreshToken(refreshTokens);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('provider_access_token');

      if (storedToken) {
        const secondsLeft = tokenSecondsRemaining(storedToken);
        if (secondsLeft > 120) {
          // Token still valid with comfortable margin — use it directly.
          setToken(storedToken);
        } else {
          // Token expired or about to expire — refresh immediately via cookie.
          const success = await refreshTokens();
          if (!success) {
            setToken(null);
            localStorage.removeItem('provider_access_token');
          }
        }
      } else {
        // No stored token — try silent refresh via HttpOnly cookie.
        const success = await refreshTokens();
        if (!success) {
          setToken(null);
          localStorage.removeItem('provider_access_token');
        }
      }
      setIsInitialized(true);
    };

    initializeAuth();
  }, [refreshTokens]);

  const login = useCallback((accessToken: string) => {
    setToken(accessToken);
    localStorage.setItem('provider_access_token', accessToken);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    localStorage.removeItem('provider_access_token');
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/logout`, {
        method: 'POST',
        headers: {
          'X-Source': 'providers_panel',
        },
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }
    window.location.href = '/login';
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => refreshTokens(), [refreshTokens]);

  return (
    <UserContext.Provider value={{ user, token, isInitialized, isLoading, error, login, logout, refreshToken }}>
      {children}
    </UserContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a UserProvider');
  }
  return context;
};
