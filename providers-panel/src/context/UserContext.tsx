import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import { User } from '@/types/user';
import { setGlobalRefreshToken } from '@/services/api';

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
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        localStorage.setItem('provider_access_token', data.access_token);
        return true;
      } else {
        // Clear tokens on refresh failure
        setToken(null);
        localStorage.removeItem('provider_access_token');
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear tokens on refresh failure
      setToken(null);
      localStorage.removeItem('provider_access_token');
      return false;
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('provider_access_token');
      
      if (storedToken) {
        setToken(storedToken);
      } else {
        // Try to refresh token on app start using cookie
        const success = await refreshTokens();
        if (!success) {
          // If refresh fails, clear any remaining tokens
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

  useEffect(() => {
    setGlobalRefreshToken(refreshTokens);
  }, [refreshTokens]);

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
