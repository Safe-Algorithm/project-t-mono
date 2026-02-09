import { api } from './api';

export interface TripUpdate {
  id: string;
  trip_id: string;
  provider_id: string;
  registration_id: string | null;
  title: string;
  message: string;
  attachments: any[] | null;
  is_important: boolean;
  created_at: string;
  total_recipients: number;
  read_count: number;
}

export const tripUpdateService = {
  listAll: () => {
    return api.get<TripUpdate[]>(`/admin/trip-updates`);
  },

  listForTrip: (tripId: string) => {
    return api.get<TripUpdate[]>(`/admin/trips/${tripId}/updates`);
  },
};
