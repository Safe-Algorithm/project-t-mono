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
  read: boolean;
  total_recipients?: number;
  read_count?: number;
}

export interface TripUpdateReceipt {
  id: string;
  update_id: string;
  user_id: string;
  read_at: string;
}

export interface TripUpdateCreate {
  title: string;
  message: string;
  attachments?: any[];
  is_important?: boolean;
}

export const tripUpdateService = {
  sendToAll: (tripId: string, data: TripUpdateCreate) => {
    return api.post<TripUpdate>(`/provider/trips/${tripId}/updates`, data);
  },

  sendToRegistration: (registrationId: string, data: TripUpdateCreate) => {
    return api.post<TripUpdate>(`/provider/registrations/${registrationId}/updates`, data);
  },

  listForTrip: (tripId: string) => {
    return api.get<TripUpdate[]>(`/provider/trips/${tripId}/updates`);
  },

  getReceipts: (updateId: string) => {
    return api.get<TripUpdateReceipt[]>(`/provider/updates/${updateId}/receipts`);
  },
};
