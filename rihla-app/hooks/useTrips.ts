import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import i18n from '../lib/i18n';
import apiClient from '../lib/api';
import { Trip, TripRating, Review, TripRegistration, ProviderProfile, TripUpdate } from '../types/trip';

export interface FieldOption {
  value: string;
  label: string;
  label_ar?: string;
}

export interface FieldMetadata {
  field_name: string;
  display_name: string;
  display_name_ar?: string;
  ui_type: string;
  placeholder?: string;
  placeholder_ar?: string;
  required: boolean;
  options?: FieldOption[];
  available_validations?: string[];
}

export function useFieldMetadata() {
  return useQuery<Record<string, FieldMetadata>>({
    queryKey: ['field-metadata', i18n.language],
    queryFn: async () => {
      const { data } = await apiClient.get<{ fields: FieldMetadata[] }>('/public-trips/field-metadata');
      return Object.fromEntries(data.fields.map((f) => [f.field_name, f]));
    },
    staleTime: 1000 * 60 * 60,
  });
}

export interface TripFilters {
  search?: string;
  start_date_from?: string;
  start_date_to?: string;
  min_price?: number;
  max_price?: number;
  min_participants?: number;
  max_participants?: number;
  min_rating?: number;
  starting_city_id?: string;
  is_international?: boolean;
  destination_ids?: string[];
  single_destination?: boolean;
  amenities?: string[];
  skip?: number;
  limit?: number;
}

export interface DestinationOption {
  id: string;
  name_en: string;
  name_ar: string;
  type: string;
  country_code: string;
  children?: DestinationOption[];
}

export function useDestinations() {
  return useQuery<DestinationOption[]>({
    queryKey: ['destinations', 'active'],
    queryFn: async () => {
      const { data } = await apiClient.get<DestinationOption[]>('/destinations');
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
}

const PAGE_SIZE = 20;

function buildTripParams(filters: TripFilters, skip: number, limit: number): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === undefined || v === '') return;
    if ((k === 'destination_ids' || k === 'amenities') && Array.isArray(v)) {
      (v as string[]).forEach((val) => params.append(k, val));
    } else {
      params.append(k, String(v));
    }
  });
  params.set('skip', String(skip));
  params.set('limit', String(limit));
  return params;
}

export function usePublicTrips(filters: TripFilters = {}) {
  return useQuery({
    queryKey: ['trips', 'public', filters],
    queryFn: async () => {
      const params = buildTripParams(filters, 0, 100);
      const { data } = await apiClient.get<Trip[]>(`/public-trips?${params}`);
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useInfinitePublicTrips(filters: TripFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['trips', 'public', 'infinite', filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = buildTripParams(filters, pageParam as number, PAGE_SIZE);
      const { data } = await apiClient.get<Trip[]>(`/public-trips?${params}`);
      return data;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    staleTime: 1000 * 60 * 2,
  });
}

export function useProviderTrips(providerId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['trips', 'provider', providerId, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ provider_id: providerId!, limit: String(limit) });
      const { data } = await apiClient.get<Trip[]>(`/public-trips?${params}`);
      return data;
    },
    enabled: !!providerId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useInfiniteProviderTrips(providerId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['trips', 'provider', 'infinite', providerId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        provider_id: providerId!,
        skip: String(pageParam as number),
        limit: String(PAGE_SIZE),
      });
      const { data } = await apiClient.get<Trip[]>(`/public-trips?${params}`);
      return data;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    enabled: !!providerId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useTrip(tripId: string | null) {
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
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useInfiniteRegistrations() {
  return useInfiniteQuery({
    queryKey: ['registrations', 'me', 'infinite'],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await apiClient.get<TripRegistration[]>(
        `/users/me/registrations?skip=${pageParam as number}&limit=${PAGE_SIZE}`
      );
      return data;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    refetchOnMount: 'always',
    staleTime: 0,
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

export function useRegistration(registrationId: string | null) {
  return useQuery<TripRegistration>({
    queryKey: ['registrations', registrationId],
    queryFn: async () => {
      const { data } = await apiClient.get<TripRegistration>(`/trips/registrations/${registrationId}`);
      return data;
    },
    enabled: !!registrationId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending_payment' ? 5000 : false;
    },
  });
}

export interface CardDetails {
  name: string;
  number: string;
  month: number;
  year: number;
  cvc: string;
}

export interface PaymentPrepareResponse {
  payment_db_id: string;
  amount_halalas: number;
  currency: string;
  description: string;
  callback_url: string;
}

export function usePreparePayment() {
  return useMutation({
    mutationFn: async ({
      registrationId,
      paymentMethod,
      redirectUrl,
    }: {
      registrationId: string;
      paymentMethod: string;
      redirectUrl: string;
    }): Promise<PaymentPrepareResponse> => {
      const { data } = await apiClient.post<PaymentPrepareResponse>('/payments/prepare', {
        registration_id: registrationId,
        payment_method: paymentMethod,
        redirect_url: redirectUrl,
      });
      return data;
    },
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      paymentDbId,
      moyasarPaymentId,
    }: {
      paymentDbId: string;
      moyasarPaymentId: string;
    }): Promise<void> => {
      await apiClient.post('/payments/confirm', null, {
        params: { payment_db_id: paymentDbId, moyasar_payment_id: moyasarPaymentId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', 'me'] });
    },
  });
}

export function useTripUpdates(tripId: string | null) {
  return useQuery<TripUpdate[]>({
    queryKey: ['trip-updates', tripId],
    queryFn: async () => {
      const { data } = await apiClient.get<TripUpdate[]>(`/trips/${tripId}/updates`);
      return data;
    },
    enabled: !!tripId,
    staleTime: 1000 * 30,
  });
}

export function useMarkUpdateRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updateId: string) => {
      await apiClient.post(`/updates/${updateId}/mark-read`, {});
    },
    onSuccess: (_data, updateId) => {
      qc.invalidateQueries({ queryKey: ['trip-updates'] });
    },
  });
}

export function useAllMyTripUpdates() {
  const { data: registrations } = useMyRegistrations();
  return useQuery<TripUpdate[]>({
    queryKey: ['all-trip-updates', registrations?.map((r) => r.trip_id)],
    queryFn: async () => {
      if (!registrations?.length) return [];
      const results = await Promise.all(
        registrations
          .filter((r) => r.status === 'confirmed' || r.status === 'pending_payment')
          .map((r) =>
            apiClient
              .get<TripUpdate[]>(`/trips/${r.trip_id}/updates`)
              .then((res) => res.data)
              .catch(() => [] as TripUpdate[])
          )
      );
      return results.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!registrations?.length,
    staleTime: 1000 * 30,
  });
}
