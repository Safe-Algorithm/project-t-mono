import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
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

  const refreshTokens = async (): Promise<boolean> => {
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
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  const login = (accessToken: string) => {
    setToken(accessToken);
    localStorage.setItem('admin_access_token', accessToken);
  };

  const logout = async () => {
    setToken(null);
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token'); // Clean up any old refresh tokens
    // Clear refresh token cookie by calling logout endpoint
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/logout`, {
        method: 'POST',
        headers: {
          'X-Source': 'admin_panel',
        },
        credentials: 'include',
      });
    } catch (error) {
      // Ignore errors on logout
      console.warn('Logout request failed:', error);
    }
    // Redirect to login page
    window.location.href = '/login';
  };

  const refreshToken = async (): Promise<boolean> => {
    return refreshTokens();
  };

  // Set the global refresh token function for the API service
  useEffect(() => {
    setGlobalRefreshToken(refreshTokens);
  }, []);

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
  }, []);

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
