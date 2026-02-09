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
  // Admin support tickets (User → Admin)
  listAdminTickets: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return api.get<SupportTicket[]>(`/admin/support/tickets${query}`);
  },

  getAdminTicket: (ticketId: string) => {
    return api.get<SupportTicketWithMessages>(`/admin/support/tickets/${ticketId}`);
  },

  updateAdminTicket: (ticketId: string, data: { status?: string; priority?: string; category?: string }) => {
    return api.patch<SupportTicket>(`/admin/support/tickets/${ticketId}`, data);
  },

  replyAdminTicket: (ticketId: string, message: string) => {
    return api.post<TicketMessage>(`/admin/support/tickets/${ticketId}/messages`, { message });
  },

  // Trip support tickets (User → Provider) - admin can view all
  listTripTickets: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return api.get<TripSupportTicket[]>(`/admin/support/trip-tickets${query}`);
  },

  getTripTicket: (ticketId: string) => {
    return api.get<TripSupportTicketWithMessages>(`/admin/support/trip-tickets/${ticketId}`);
  },
};
