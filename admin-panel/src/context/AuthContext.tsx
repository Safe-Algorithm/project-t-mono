import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { setGlobalRefreshToken } from '@/services/api';

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
        credentials: 'include', // Include cookies
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

  const login = useCallback((accessToken: string) => {
    setToken(accessToken);
    localStorage.setItem('admin_access_token', accessToken);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token'); // Clean up any old refresh tokens
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
    setGlobalRefreshToken(refreshTokens);
  }, [refreshTokens]);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('admin_access_token');
      
      if (storedToken) {
        setToken(storedToken);
      } else {
        // Try to refresh token on app start using cookie
        const success = await refreshTokens();
        if (!success) {
          // If refresh fails, clear any remaining tokens
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
