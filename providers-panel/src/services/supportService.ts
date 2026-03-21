import { api } from './api';

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
  status: string;
  priority: string;
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

export const supportService = {
  // ── Trip tickets (user → provider) ──────────────────────────────
  listTickets: (status?: string, skip = 0, limit = 50) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    return api.get<TripSupportTicket[]>(`/provider/support/tickets?${params}`);
  },

  getTicket: (ticketId: string) => {
    return api.get<TripSupportTicketWithMessages>(`/provider/support/tickets/${ticketId}`);
  },

  updateTicket: (ticketId: string, data: { status?: string; priority?: string }) => {
    return api.patch<TripSupportTicket>(`/provider/support/tickets/${ticketId}`, data);
  },

  replyTicket: (ticketId: string, message: string) => {
    return api.post<TicketMessage>(`/provider/support/tickets/${ticketId}/messages`, { message });
  },

  // ── Admin tickets (provider → admin) ────────────────────────────
  listAdminTickets: (skip = 0, limit = 50) => {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    return api.get<SupportTicket[]>(`/provider/support/admin-tickets?${params}`);
  },

  createAdminTicket: (data: { subject: string; description: string; category?: string; priority?: string }) => {
    return api.post<SupportTicket>('/provider/support/admin-tickets', data);
  },

  getAdminTicket: (ticketId: string) => {
    return api.get<SupportTicketWithMessages>(`/provider/support/admin-tickets/${ticketId}`);
  },

  replyAdminTicket: (ticketId: string, message: string) => {
    return api.post<TicketMessage>(`/provider/support/admin-tickets/${ticketId}/messages`, { message });
  },
};
