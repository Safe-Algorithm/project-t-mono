import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types/user';
import { teamService } from '@/services/teamService';

export const useTeamMembers = () => {
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teamService.getTeamMembers();
      setMembers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch team members');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, isLoading, error, refreshMembers: fetchMembers };
};
