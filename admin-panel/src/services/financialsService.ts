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

export interface ProviderFinancialSummary {
  provider_id: string;
  provider_name: string;
  commission_rate: string;
  total_gross_earned: string;
  total_platform_cut: string;
  total_provider_earned: string;
  total_paid_out: string;
  total_owed: string;
  last_payout_date: string | null;
  unpaid_booking_count: number;
}

export interface AdminFinancialsOverview {
  providers: ProviderFinancialSummary[];
  grand_total_owed: string;
  grand_total_paid_out: string;
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

export interface TripFinancialSummary {
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
}

export interface PayoutCreate {
  earning_line_ids: string[];
  note?: string;
  bank_transfer_reference?: string;
}

export interface PayoutComplete {
  receipt_file_url?: string;
  note?: string;
  bank_transfer_reference?: string;
}

// ─── Admin API calls ──────────────────────────────────────────────────────────

export const getFinancialsOverview = (): Promise<AdminFinancialsOverview> =>
  api.get<AdminFinancialsOverview>('/admin/financials/overview');

export const getProviderOwedLines = (providerId: string): Promise<EarningLineRead[]> =>
  api.get<EarningLineRead[]>(`/admin/financials/providers/${providerId}/owed`);

export const getProviderFinancialSummary = (providerId: string): Promise<ProviderFinancialSummary> =>
  api.get<ProviderFinancialSummary>(`/admin/financials/providers/${providerId}/summary`);

export const createPayout = (providerId: string, data: PayoutCreate): Promise<ProviderPayoutDetail> =>
  api.post<ProviderPayoutDetail>(`/admin/financials/providers/${providerId}/payouts`, data);

export const completePayout = (payoutId: string, data: PayoutComplete): Promise<ProviderPayoutDetail> =>
  api.patch<ProviderPayoutDetail>(`/admin/financials/payouts/${payoutId}/complete`, data);

export const listAllPayouts = (providerId?: string): Promise<ProviderPayoutRead[]> => {
  const qs = providerId ? `?provider_id=${providerId}` : '';
  return api.get<ProviderPayoutRead[]>(`/admin/financials/payouts${qs}`);
};

export const getPayoutDetail = (payoutId: string): Promise<ProviderPayoutDetail> =>
  api.get<ProviderPayoutDetail>(`/admin/financials/payouts/${payoutId}`);

export const getTripFinancialDetail = (tripId: string): Promise<TripFinancialDetail> =>
  api.get<TripFinancialDetail>(`/admin/financials/trips/${tripId}`);

export const getProviderTripsSummary = (providerId: string): Promise<TripFinancialSummary[]> => {
  const qs = `?provider_id=${providerId}`;
  return api.get<TripFinancialSummary[]>(`/admin/financials/trips/by-provider${qs}`);
};

export const updateCommissionRate = (providerId: string, commissionRate: number): Promise<{ ok: boolean; commission_rate: number }> =>
  api.patch<{ ok: boolean; commission_rate: number }>(`/admin/providers/${providerId}/commission`, { commission_rate: commissionRate });
