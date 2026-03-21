import apiClient from './api';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TripSupportTicket {
  id: string;
  user_id: string;
  provider_id: string;
  trip_id: string;
  registration_id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketMessage {
  id: string;
  sender_id: string;
  sender_type: 'user' | 'admin' | 'provider';
  message: string;
  attachments: any[] | null;
  created_at: string;
}

export interface SupportTicketWithMessages extends SupportTicket {
  messages: TicketMessage[];
}

export interface TripSupportTicketWithMessages extends TripSupportTicket {
  messages: TicketMessage[];
}

// ── Admin tickets (user → admin) ─────────────────────────────────────────────

export const listAdminTickets = (): Promise<{ data: SupportTicket[] }> =>
  apiClient.get('/support/tickets');

export const getAdminTicket = (id: string): Promise<{ data: SupportTicketWithMessages }> =>
  apiClient.get(`/support/tickets/${id}`);

export const createAdminTicket = (payload: {
  subject: string;
  description: string;
  category: string;
  priority?: string;
}): Promise<{ data: SupportTicket }> =>
  apiClient.post('/support/tickets', payload);

export const replyAdminTicket = (id: string, message: string): Promise<{ data: TicketMessage }> =>
  apiClient.post(`/support/tickets/${id}/messages`, { message });

// ── Trip tickets (user → provider) ───────────────────────────────────────────

export const listTripTicketsByTrip = (tripId: string): Promise<{ data: TripSupportTicket[] }> =>
  apiClient.get(`/trips/${tripId}/support`);

export const listMyTripTickets = (): Promise<{ data: TripSupportTicket[] }> =>
  apiClient.get('/support/trip-tickets');

export const getTripTicket = (id: string): Promise<{ data: TripSupportTicketWithMessages }> =>
  apiClient.get(`/support/trip-tickets/${id}`);

export const createTripTicket = (
  tripId: string,
  registrationId: string,
  payload: { subject: string; description: string; priority?: string },
): Promise<{ data: TripSupportTicket }> =>
  apiClient.post(`/trips/${tripId}/support`, { registration_id: registrationId, ...payload });

export const replyTripTicket = (id: string, message: string): Promise<{ data: TicketMessage }> =>
  apiClient.post(`/support/trip-tickets/${id}/messages`, { message });
