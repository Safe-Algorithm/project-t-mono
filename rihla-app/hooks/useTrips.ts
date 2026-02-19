import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import i18n from '../lib/i18n';
import apiClient from '../lib/api';
import { Trip, TripRating, Review, TripRegistration, ProviderProfile } from '../types/trip';

export interface TripFilters {
  search?: string;
  start_date_from?: string;
  start_date_to?: string;
  min_price?: number;
  max_price?: number;
  min_participants?: number;
  max_participants?: number;
  min_rating?: number;
  skip?: number;
  limit?: number;
}

export function usePublicTrips(filters: TripFilters = {}) {
  return useQuery({
    queryKey: ['trips', 'public', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.append(k, String(v));
      });
      const { data } = await apiClient.get<Trip[]>(`/public-trips?${params}`);
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId],
    queryFn: async () => {
      const { data } = await apiClient.get<Trip>(`/public-trips/${tripId}`);
      return data;
    },
    enabled: !!tripId,
  });
}

export function useTripRating(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'rating'],
    queryFn: async () => {
      const { data } = await apiClient.get<TripRating>(`/reviews/trips/${tripId}/rating`);
      return data;
    },
    enabled: !!tripId,
  });
}

export function useTripReviews(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'reviews'],
    queryFn: async () => {
      const { data } = await apiClient.get<Review[]>(`/reviews/trips/${tripId}`);
      return data;
    },
    enabled: !!tripId,
  });
}

export function useMyRegistrations() {
  return useQuery({
    queryKey: ['registrations', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<TripRegistration[]>('/users/me/registrations');
      return data;
    },
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const { data } = await apiClient.get<Trip[]>('/favorites');
      return data;
    },
    retry: 1,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, isFav }: { tripId: string; isFav: boolean }) => {
      if (isFav) {
        await apiClient.delete(`/trips/${tripId}/favorite`);
      } else {
        await apiClient.post(`/trips/${tripId}/favorite`, {});
      }
    },
    onMutate: async ({ tripId, isFav }) => {
      await qc.cancelQueries({ queryKey: ['favorites'] });
      const previous = qc.getQueryData<Trip[]>(['favorites']);
      qc.setQueryData<Trip[]>(['favorites'], (old) => {
        if (!old) return old;
        if (isFav) return old.filter((t) => t.id !== tripId);
        return old;
      });
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(['favorites'], context.previous);
      }
      Alert.alert(i18n.t('common.error'), i18n.t('favorites.errorUpdate'));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

export function useProviderProfile(providerId: string) {
  return useQuery({
    queryKey: ['providers', providerId],
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderProfile>(`/provider-profiles/${providerId}`);
      return data;
    },
    enabled: !!providerId,
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, rating, comment }: { tripId: string; rating: number; comment?: string }) => {
      const { data } = await apiClient.post(`/reviews/trips/${tripId}`, { rating, comment });
      return data;
    },
    onSuccess: (_, { tripId }) => {
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'reviews'] });
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'rating'] });
    },
  });
}
