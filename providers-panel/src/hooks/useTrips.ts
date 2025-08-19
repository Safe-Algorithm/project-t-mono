import { useState, useEffect } from 'react';
import { tripService } from '../services/tripService';
import { Trip } from '../types/trip';

export const useTrips = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        setIsLoading(true);
        const fetchedTrips = await tripService.getAll();
        setTrips(fetchedTrips);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch trips');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrips();
  }, []);

  return { trips, isLoading, error };
};
