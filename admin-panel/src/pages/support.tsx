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
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  waiting_on_user: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
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

  // Detail view for admin ticket
  if (selectedTicket) {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={closeDetail} className="mb-4 text-blue-600 hover:underline">{t('support.backToList')}</button>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{selectedTicket.subject}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('support.created')}: {formatDate(selectedTicket.created_at)}</p>
              <p className="text-sm text-gray-500">{t('support.userId')}: {selectedTicket.user_id}</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[selectedTicket.status] || ''}`}>
                {selectedTicket.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${priorityColors[selectedTicket.priority] || ''}`}>
                {selectedTicket.priority}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                {selectedTicket.category}
              </span>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">{selectedTicket.description}</p>

          <div className="flex gap-4 mb-4 border-t pt-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">{t('support.status')}</label>
              <select
                value={selectedTicket.status}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                disabled={updating}
                className="border rounded px-3 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">{t('support.priority')}</label>
              <select
                value={selectedTicket.priority}
                onChange={(e) => handleUpdatePriority(e.target.value)}
                disabled={updating}
                className="border rounded px-3 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
              >
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{t('support.messages')} ({selectedTicket.messages.length})</h3>
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
            {selectedTicket.messages.length === 0 && (
              <p className="text-gray-500 text-sm">{t('support.noMessages')}</p>
            )}
            {selectedTicket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.sender_type === 'admin'
                    ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
                    : 'bg-gray-50 dark:bg-gray-700 mr-8'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-medium ${
                    msg.sender_type === 'admin' ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {msg.sender_type === 'admin' ? t('support.admin') : t('support.user')}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(msg.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
          </div>

          {selectedTicket.status !== 'closed' && (
            <div className="flex gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={t('support.replyPlaceholder')}
                className="flex-1 border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 resize-none"
                rows={2}
              />
              <button
                onClick={handleReply}
                disabled={updating || !replyText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium self-end"
              >
                {t('support.reply')}
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
      <div className="max-w-4xl mx-auto">
        <button onClick={closeDetail} className="mb-4 text-blue-600 hover:underline">{t('support.backToList')}</button>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{selectedTripTicket.subject}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('support.created')}: {formatDate(selectedTripTicket.created_at)}</p>
              <p className="text-sm text-gray-500">{t('support.user')}: {selectedTripTicket.user_id}</p>
              <p className="text-sm text-gray-500">{t('support.provider')}: {selectedTripTicket.provider_id}</p>
              <p className="text-sm text-gray-500">{t('support.tripId')}: {selectedTripTicket.trip_id}</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[selectedTripTicket.status] || ''}`}>
                {selectedTripTicket.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${priorityColors[selectedTripTicket.priority] || ''}`}>
                {selectedTripTicket.priority}
              </span>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedTripTicket.description}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{t('support.messages')} ({selectedTripTicket.messages.length})</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedTripTicket.messages.length === 0 && (
              <p className="text-gray-500 text-sm">{t('support.noMessages')}</p>
            )}
            {selectedTripTicket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.sender_type === 'provider'
                    ? 'bg-green-50 dark:bg-green-900/20 ml-8'
                    : 'bg-gray-50 dark:bg-gray-700 mr-8'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {msg.sender_type === 'provider' ? t('support.provider') : t('support.user')}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(msg.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">{t('support.adminReadOnly')}</p>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{t('support.title')}</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">{t('support.dismiss')}</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setActiveTab('admin'); setStatusFilter(''); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'admin' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {t('support.adminTickets')}
        </button>
        <button
          onClick={() => { setActiveTab('trip'); setStatusFilter(''); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'trip' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {t('support.tripTickets')}
        </button>
      </div>

      {/* Status filter */}
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="">{t('support.allStatuses')}</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">{t('support.loadingTickets')}</p>
      ) : activeTab === 'admin' ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {adminTickets.length === 0 ? (
            <p className="p-6 text-gray-500">{t('support.noAdminTickets')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">{t('support.subject')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('support.category')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('support.priority')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('support.status')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('support.created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {adminTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => openAdminTicket(ticket.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium">{ticket.subject}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{ticket.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${priorityColors[ticket.priority] || ''}`}>{ticket.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[ticket.status] || ''}`}>{ticket.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(ticket.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {tripTickets.length === 0 ? (
            <p className="p-6 text-gray-500">{t('support.noTripTickets')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">{t('support.subject')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('support.priority')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('support.status')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('support.created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tripTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => openTripTicket(ticket.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium">{ticket.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${priorityColors[ticket.priority] || ''}`}>{ticket.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[ticket.status] || ''}`}>{ticket.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(ticket.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default SupportPage;
