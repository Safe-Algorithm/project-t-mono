import { api } from './api';
import { Trip } from '../types/trip';

export interface TripCreatePayload {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  price: number;
  max_participants: number;
  trip_metadata?: Record<string, any>;
}

export interface TripUpdatePayload extends Partial<TripCreatePayload> {
  is_active?: boolean;
}

export const tripService = {
  getAll: (): Promise<Trip[]> => {
    return api.get<Trip[]>('/trips/');
  },

  getById: (id: string): Promise<Trip> => {
    return api.get<Trip>(`/trips/${id}`);
  },

  create: (payload: TripCreatePayload): Promise<Trip> => {
    return api.post<Trip>('/trips/', payload);
  },

  update: (id: string, payload: TripUpdatePayload): Promise<Trip> => {
    return api.put<Trip>(`/trips/${id}`, payload);
  },

  delete: (id: string): Promise<void> => {
    return api.del<void>(`/trips/${id}`);
  },
};
