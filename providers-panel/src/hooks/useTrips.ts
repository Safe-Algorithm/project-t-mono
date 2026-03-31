import { useState, useEffect } from 'react';
import { tripService, TripFilterParams } from '../services/tripService';
import { Trip } from '../types/trip';

export const useTrips = (filters?: TripFilterParams) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = async () => {
    try {
      setIsLoading(true);
      const fetchedTrips = await tripService.getAll(filters);
      setTrips(fetchedTrips);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trips');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [filters?.search, filters?.start_date_from, filters?.start_date_to, filters?.min_price, filters?.max_price, filters?.min_participants, filters?.max_participants, filters?.min_rating, filters?.is_active]);

  return { trips, isLoading, error, refetch: fetchTrips };
};
