import { api } from './api';

export interface EarningLineRead {
  id: string;
  registration_id: string;
  provider_id: string;
  trip_id: string;
  gross_amount: string;
  platform_cut_pct: string;
  platform_cut_amount: string;
  provider_amount: string;
  payout_id: string | null;
  became_owed_at: string;
  created_at: string;
  booking_reference: string | null;
  trip_name: string | null;
  booking_date: string | null;
}

export interface ProviderPayoutRead {
  id: string;
  provider_id: string;
  total_gross: string;
  total_platform_cut: string;
  total_provider_amount: string;
  booking_count: number;
  status: 'pending' | 'completed';
  note: string | null;
  bank_transfer_reference: string | null;
  receipt_file_url: string | null;
  paid_by_admin_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  provider_name: string | null;
  paid_by_admin_name: string | null;
}

export interface ProviderPayoutDetail extends ProviderPayoutRead {
  earning_lines: EarningLineRead[];
}

export interface ProviderFinancialsSelf {
  commission_rate: string;
  total_gross_earned: string;
  total_platform_cut: string;
  total_provider_earned: string;
  total_paid_out: string;
  total_owed: string;
  last_payout_date: string | null;
  unpaid_booking_count: number;
}

export interface TripFinancialSummary {
  trip_id: string;
  trip_name: string;
  total_bookings: number;
  paid_out_count: number;
  owed_count: number;
  total_gross: string;
  total_provider_amount: string;
  owed_amount: string;
  paid_out_amount: string;
}

export interface TripEarningStatus {
  registration_id: string;
  booking_reference: string;
  booking_date: string;
  gross_amount: string;
  platform_cut_amount: string;
  provider_amount: string;
  status: 'paid_out' | 'owed' | 'refundable' | 'cancelled';
  payout_id: string | null;
  paid_out_at: string | null;
  user_name: string | null;
  user_email: string | null;
}

export interface TripFinancialDetail {
  trip_id: string;
  trip_name: string;
  total_bookings: number;
  paid_out_count: number;
  owed_count: number;
  refundable_count: number;
  cancelled_count: number;
  total_gross: string;
  total_platform_cut: string;
  total_provider_amount: string;
  paid_out_amount: string;
  owed_amount: string;
  bookings: TripEarningStatus[];
}

// ─── Provider API calls ───────────────────────────────────────────────────────

export const getProviderFinancialsSummary = (): Promise<ProviderFinancialsSelf> =>
  api.get<ProviderFinancialsSelf>('/provider/financials/summary');

export const getProviderEarnings = (statusFilter?: string, tripId?: string): Promise<EarningLineRead[]> => {
  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (tripId) params.set('trip_id', tripId);
  const qs = params.toString();
  return api.get<EarningLineRead[]>(`/provider/financials/earnings${qs ? `?${qs}` : ''}`);
};

export const getProviderTripsFinancials = (): Promise<TripFinancialSummary[]> =>
  api.get<TripFinancialSummary[]>('/provider/financials/trips');

export const getProviderTripFinancialDetail = (tripId: string): Promise<TripFinancialDetail> =>
  api.get<TripFinancialDetail>(`/provider/financials/trips/${tripId}`);

export const getProviderPayouts = (): Promise<ProviderPayoutRead[]> =>
  api.get<ProviderPayoutRead[]>('/provider/financials/payouts');

export const getProviderPayoutDetail = (payoutId: string): Promise<ProviderPayoutDetail> =>
  api.get<ProviderPayoutDetail>(`/provider/financials/payouts/${payoutId}`);
