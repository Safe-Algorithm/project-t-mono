import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import {
  supportService,
  SupportTicket,
  TripSupportTicket,
  SupportTicketWithMessages,
  TripSupportTicketWithMessages,
  TicketMessage,
} from '../services/supportService';

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const CATEGORY_OPTIONS = ['technical', 'billing', 'general'];

const statusColors: Record<string, string> = {
  open: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
  in_progress: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  waiting_on_user: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  resolved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  closed: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  medium: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const SupportPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'admin' | 'trip'>('admin');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [adminTickets, setAdminTickets] = useState<SupportTicket[]>([]);
  const [tripTickets, setTripTickets] = useState<TripSupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketWithMessages | null>(null);
  const [selectedTripTicket, setSelectedTripTicket] = useState<TripSupportTicketWithMessages | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [activeTab, statusFilter]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'admin') {
        const data = await supportService.listAdminTickets(statusFilter || undefined);
        setAdminTickets(data);
      } else {
        const data = await supportService.listTripTickets(statusFilter || undefined);
        setTripTickets(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const openAdminTicket = async (ticketId: string) => {
    try {
      const data = await supportService.getAdminTicket(ticketId);
      setSelectedTicket(data);
      setSelectedTripTicket(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openTripTicket = async (ticketId: string) => {
    try {
      const data = await supportService.getTripTicket(ticketId);
      setSelectedTripTicket(data);
      setSelectedTicket(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      await supportService.updateAdminTicket(selectedTicket.id, { status });
      await openAdminTicket(selectedTicket.id);
      await loadTickets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePriority = async (priority: string) => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      await supportService.updateAdminTicket(selectedTicket.id, { priority });
      await openAdminTicket(selectedTicket.id);
      await loadTickets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      await supportService.replyAdminTicket(selectedTicket.id, replyText);
      setReplyText('');
      await openAdminTicket(selectedTicket.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const closeDetail = () => {
    setSelectedTicket(null);
    setSelectedTripTicket(null);
    setReplyText('');
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  const selectCls = "px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition";

  // Detail view for admin ticket
  if (selectedTicket) {
    return (
      <div className="max-w-3xl space-y-5">
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to list
        </button>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatDate(selectedTicket.created_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[selectedTicket.status] || ''}`}>{selectedTicket.status.replace(/_/g,' ')}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityColors[selectedTicket.priority] || ''}`}>{selectedTicket.priority}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">{selectedTicket.category}</span>
            </div>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-5">{selectedTicket.description}</p>
          <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={selectedTicket.status} onChange={e => handleUpdateStatus(e.target.value)} disabled={updating} className={selectCls}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Priority</label>
              <select value={selectedTicket.priority} onChange={e => handleUpdatePriority(e.target.value)} disabled={updating} className={selectCls}>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Messages ({selectedTicket.messages.length})</h3>
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
            {selectedTicket.messages.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm">No messages yet.</p>}
            {selectedTicket.messages.map(msg => (
              <div key={msg.id} className={`p-3 rounded-xl text-sm ${
                msg.sender_type === 'admin'
                  ? 'bg-sky-50 dark:bg-sky-900/20 ml-8 border border-sky-100 dark:border-sky-800/30'
                  : 'bg-slate-50 dark:bg-slate-800/50 mr-8 border border-slate-100 dark:border-slate-700'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-semibold ${msg.sender_type === 'admin' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {msg.sender_type === 'admin' ? 'Admin' : 'User'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(msg.created_at)}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
          </div>
          {selectedTicket.status !== 'closed' && (
            <div className="flex gap-2">
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…"
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                rows={2} />
              <button onClick={handleReply} disabled={updating || !replyText.trim()}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 self-end transition-colors">
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Detail view for trip ticket (read-only for admin)
  if (selectedTripTicket) {
    return (
      <div className="max-w-3xl space-y-5">
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to list
        </button>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTripTicket.subject}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatDate(selectedTripTicket.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[selectedTripTicket.status] || ''}`}>{selectedTripTicket.status.replace(/_/g,' ')}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityColors[selectedTripTicket.priority] || ''}`}>{selectedTripTicket.priority}</span>
            </div>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedTripTicket.description}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Messages ({selectedTripTicket.messages.length})</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedTripTicket.messages.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm">No messages yet.</p>}
            {selectedTripTicket.messages.map(msg => (
              <div key={msg.id} className={`p-3 rounded-xl text-sm ${
                msg.sender_type === 'provider'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 ml-8 border border-emerald-100 dark:border-emerald-800/30'
                  : 'bg-slate-50 dark:bg-slate-800/50 mr-8 border border-slate-100 dark:border-slate-700'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 capitalize">{msg.sender_type}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(msg.created_at)}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">Admin view is read-only for trip tickets.</p>
        </div>
      </div>
    );
  }

  const thCls = "text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide";

  // List view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support Tickets</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage and respond to support requests</p>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:opacity-70 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
          <button onClick={() => { setActiveTab('admin'); setStatusFilter(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'admin' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            Admin Tickets
          </button>
          <button onClick={() => { setActiveTab('trip'); setStatusFilter(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'trip' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            Trip Tickets
          </button>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-7 h-7 rounded-full border-4 border-sky-500 border-t-transparent" />
        </div>
      ) : activeTab === 'admin' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {adminTickets.length === 0 ? (
            <p className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No admin tickets found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className={thCls}>Subject</th>
                  <th className={`${thCls} hidden sm:table-cell`}>Category</th>
                  <th className={`${thCls} hidden md:table-cell`}>Priority</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} hidden lg:table-cell`}>Created</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adminTickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => openAdminTicket(ticket.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group">
                      <td className="py-3 px-4 font-semibold text-sky-600 dark:text-sky-400 group-hover:text-sky-700">{ticket.subject}</td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">{ticket.category}</span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityColors[ticket.priority] || ''}`}>{ticket.priority}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[ticket.status] || ''}`}>{ticket.status.replace(/_/g,' ')}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 dark:text-slate-500 text-xs hidden lg:table-cell">{formatDate(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {tripTickets.length === 0 ? (
            <p className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No trip tickets found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className={thCls}>Subject</th>
                  <th className={`${thCls} hidden md:table-cell`}>Priority</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} hidden lg:table-cell`}>Created</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tripTickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => openTripTicket(ticket.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group">
                      <td className="py-3 px-4 font-semibold text-sky-600 dark:text-sky-400 group-hover:text-sky-700">{ticket.subject}</td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityColors[ticket.priority] || ''}`}>{ticket.priority}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[ticket.status] || ''}`}>{ticket.status.replace(/_/g,' ')}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 dark:text-slate-500 text-xs hidden lg:table-cell">{formatDate(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SupportPage;
