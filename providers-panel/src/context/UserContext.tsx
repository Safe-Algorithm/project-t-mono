import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from '@/hooks/useUser';
import { User } from '@/types/user';

interface UserContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const { user, isLoading, error, refetch } = useUser(token);

  useEffect(() => {
    const storedToken = localStorage.getItem('provider_token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('provider_token', newToken);
    refetch();
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('provider_token');
    // user state will be cleared by the useUser hook
  };

  return (
    <UserContext.Provider value={{ user, token, isLoading, error, login, logout }}>
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
