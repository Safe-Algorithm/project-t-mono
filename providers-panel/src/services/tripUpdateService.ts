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
  is_important?: boolean;
  file?: File | null;
}

function buildUpdateFormData(data: TripUpdateCreate): FormData {
  const fd = new FormData();
  fd.append('title', data.title);
  fd.append('message', data.message);
  fd.append('is_important', String(data.is_important ?? false));
  if (data.file) fd.append('file', data.file);
  return fd;
}

export const tripUpdateService = {
  sendToAll: (tripId: string, data: TripUpdateCreate) => {
    return api.postFormData<TripUpdate>(`/provider/trips/${tripId}/updates`, buildUpdateFormData(data));
  },

  sendToRegistration: (registrationId: string, data: TripUpdateCreate) => {
    return api.postFormData<TripUpdate>(`/provider/registrations/${registrationId}/updates`, buildUpdateFormData(data));
  },

  listForTrip: (tripId: string) => {
    return api.get<TripUpdate[]>(`/provider/trips/${tripId}/updates`);
  },

  getReceipts: (updateId: string) => {
    return api.get<TripUpdateReceipt[]>(`/provider/updates/${updateId}/receipts`);
  },
};
