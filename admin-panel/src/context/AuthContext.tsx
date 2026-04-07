import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { setGlobalRefreshToken } from '@/services/api';

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

interface AuthContextType {
  token: string | null;
  isInitialized: boolean;
  login: (accessToken: string) => void;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'admin_panel',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        localStorage.setItem('admin_access_token', data.access_token);
        return true;
      } else {
        setToken(null);
        localStorage.removeItem('admin_access_token');
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      setToken(null);
      localStorage.removeItem('admin_access_token');
      return false;
    }
  }, []);

  // Register refresh function synchronously so the api layer can use it
  // before the first useEffect fires (avoids race on initial API calls).
  setGlobalRefreshToken(refreshTokens);

  const login = useCallback((accessToken: string) => {
    setToken(accessToken);
    localStorage.setItem('admin_access_token', accessToken);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    localStorage.removeItem('admin_access_token');
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/logout`, {
        method: 'POST',
        headers: {
          'X-Source': 'admin_panel',
        },
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }
    window.location.href = '/login';
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => refreshTokens(), [refreshTokens]);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('admin_access_token');

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
            localStorage.removeItem('admin_access_token');
          }
        }
      } else {
        // No stored token — try silent refresh via HttpOnly cookie.
        const success = await refreshTokens();
        if (!success) {
          setToken(null);
          localStorage.removeItem('admin_access_token');
        }
      }
      setIsInitialized(true);
    };

    initializeAuth();
  }, [refreshTokens]);

  return (
    <AuthContext.Provider value={{ token, isInitialized, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
