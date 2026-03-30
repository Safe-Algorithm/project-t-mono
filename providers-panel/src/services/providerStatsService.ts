import { api } from './api';

export interface TripBookingActionCount {
  trip_id: string;
  trip_name: string;
  awaiting_provider: number;
  processing: number;
  total_action_needed: number;
}

export interface ProviderDashboardStats {
  total_awaiting_provider: number;
  total_processing: number;
  total_action_needed: number;
  total_confirmed: number;
  total_bookings: number;
  open_tickets: number;
  total_trips: number;
  active_trips: number;
  upcoming_trips: number;
  trips_needing_action: TripBookingActionCount[];
}

export const providerStatsService = {
  getDashboardStats: (): Promise<ProviderDashboardStats> =>
    api.get<ProviderDashboardStats>('/provider/dashboard/stats'),
};
