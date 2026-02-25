import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  supportService,
  TripSupportTicket,
  TripSupportTicketWithMessages,
} from '../services/supportService';
import Pagination from '../components/ui/Pagination';

const PAGE_SIZE = 50;

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  waiting_on_user: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const ProviderSupportPage = () => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tickets, setTickets] = useState<TripSupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<TripSupportTicketWithMessages | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, page]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const skip = (page - 1) * PAGE_SIZE;
      const data = await supportService.listTickets(statusFilter || undefined, skip, PAGE_SIZE);
      setTickets(data);
      if (data.length < PAGE_SIZE && page === 1) setTotal(data.length);
      else if (data.length < PAGE_SIZE) setTotal((page - 1) * PAGE_SIZE + data.length);
      else setTotal(prev => Math.max(prev, page * PAGE_SIZE + 1));
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const openTicket = async (ticketId: string) => {
    try {
      const data = await supportService.getTicket(ticketId);
      setSelectedTicket(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      await supportService.updateTicket(selectedTicket.id, { status });
      await openTicket(selectedTicket.id);
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
      await supportService.updateTicket(selectedTicket.id, { priority });
      await openTicket(selectedTicket.id);
      await loadTickets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setUpdating(true);
    try {
      await supportService.replyTicket(selectedTicket.id, replyText);
      setReplyText('');
      await openTicket(selectedTicket.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const closeDetail = () => {
    setSelectedTicket(null);
    setReplyText('');
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  const selectCls = "px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition";

  // Detail view
  if (selectedTicket) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button onClick={closeDetail} className="flex items-center gap-1.5 text-sm text-sky-500 hover:text-sky-600 font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t('support.backToList')}
        </button>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('support.created')}: {formatDate(selectedTicket.created_at)}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('support.userId')}: {selectedTicket.user_id}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedTicket.status] || ''}`}>
                {selectedTicket.status.replace(/_/g, ' ')}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[selectedTicket.priority] || ''}`}>
                {selectedTicket.priority}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-5 leading-relaxed">{selectedTicket.description}</p>

          <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{t('support.status')}</label>
              <select value={selectedTicket.status} onChange={e => handleUpdateStatus(e.target.value)} disabled={updating} className={selectCls}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{t('support.priority')}</label>
              <select value={selectedTicket.priority} onChange={e => handleUpdatePriority(e.target.value)} disabled={updating} className={selectCls}>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">{t('support.messages')} ({selectedTicket.messages.length})</h3>
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
            {selectedTicket.messages.length === 0 && (
              <p className="text-slate-400 dark:text-slate-500 text-sm">{t('support.noMessages')}</p>
            )}
            {selectedTicket.messages.map(msg => (
              <div key={msg.id} className={`p-3 rounded-xl text-sm ${
                msg.sender_type === 'provider'
                  ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/40 ml-8'
                  : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 mr-8'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-semibold ${msg.sender_type === 'provider' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {msg.sender_type === 'provider' ? t('support.you') : t('support.customer')}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(msg.created_at)}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
          </div>

          {selectedTicket.status !== 'closed' && (
            <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t('support.replyPlaceholder')}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none transition"
                rows={2} />
              <button onClick={handleReply} disabled={updating || !replyText.trim()}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-sm font-medium self-end transition-colors">
                {t('support.reply')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('support.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('support.subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="underline text-xs">{t('support.dismiss')}</button>
        </div>
      )}

      <div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">{t('support.allStatuses')}</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {tickets.length === 0 ? (
            <p className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">{t('support.noTickets')}</p>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('support.subject')}</th>
                    <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">{t('support.priority')}</th>
                    <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('support.status')}</th>
                    <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">{t('support.created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tickets.map(ticket => (
                    <tr key={ticket.id} onClick={() => openTicket(ticket.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">{ticket.subject}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[ticket.priority] || ''}`}>{ticket.priority}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status] || ''}`}>{ticket.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 text-xs hidden md:table-cell">{formatDate(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 pb-4">
                <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderSupportPage;
