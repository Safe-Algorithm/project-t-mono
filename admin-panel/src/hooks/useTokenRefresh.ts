import { useAuth } from '@/context/AuthContext';
import { useEffect, useRef } from 'react';

export const useTokenRefresh = () => {
  const { token, refreshToken, logout } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (token) {
      intervalRef.current = setInterval(async () => {
        const success = await refreshToken();
        if (!success) {
          logout();
        }
      }, 10 * 60 * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token, refreshToken, logout]);

  // Also refresh on API call failures (401 errors)
  const handleApiCall = async (apiCall: () => Promise<Response>): Promise<Response> => {
    try {
      const response = await apiCall();
      
      if (response.status === 401) {
        // Try to refresh token
        const refreshSuccess = await refreshToken();
        if (refreshSuccess) {
          // Retry the API call with new token
          return await apiCall();
        } else {
          logout();
          throw new Error('Authentication failed');
        }
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  return { handleApiCall };
};
