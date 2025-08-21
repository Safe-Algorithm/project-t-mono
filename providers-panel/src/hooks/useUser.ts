import { useState, useEffect, useCallback } from 'react';
import { userService } from '@/services/userService';
import { User } from '@/types/user';

export const useUser = (token: string | null) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getMe();
      setUser(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        // Clear user on authentication error
        if (err.message.includes('Authentication failed') || err.message.includes('No authentication token')) {
          setUser(null);
        }
      } else {
        setError('An unknown error occurred while fetching the user.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, isLoading, error, refetch: fetchUser };
};
