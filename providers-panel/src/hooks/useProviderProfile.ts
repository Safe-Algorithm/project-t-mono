import { useState, useEffect, useCallback } from 'react';
import { Provider } from '@/types/provider';
import { providerService } from '@/services/providerService';

export const useProviderProfile = () => {
  const [profile, setProfile] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await providerService.getProviderProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error, refreshProfile: fetchProfile };
};
