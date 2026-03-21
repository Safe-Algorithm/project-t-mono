import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  supportService,
  SupportTicket,
  SupportTicketWithMessages,
  TripSupportTicket,
  TripSupportTicketWithMessages,
} from '../services/supportService';
import { PermissionDeniedError } from '../services/api';
import Pagination from '../components/ui/Pagination';
import PermissionDenied from '../components/common/PermissionDenied';

const PAGE_SIZE = 50;
const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const CATEGORY_OPTIONS = ['general', 'technical', 'billing'];

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

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition";
const selectCls = "px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition";

// ─── Trip Ticket Detail (provider replies to user) ───────────────────────────

function TripTicketDetail({
  ticket, onClose,
}: { ticket: TripSupportTicketWithMessages; onClose: () => void }) {
  const { t } = useTranslation();
  const [replyText, setReplyText] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(ticket);

  const refresh = async () => {
    const data = await supportService.getTicket(current.id);
    setCurrent(data);
  };

  const handleUpdateStatus = async (status: string) => {
    setUpdating(true);
    try { await supportService.updateTicket(current.id, { status }); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setUpdating(false); }
  };

  const handleUpdatePriority = async (priority: string) => {
    setUpdating(true);
    try { await supportService.updateTicket(current.id, { priority }); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setUpdating(false); }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setUpdating(true);
    try { await supportService.replyTicket(current.id, replyText); setReplyText(''); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setUpdating(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-sky-500 hover:text-sky-600 font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to list
      </button>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{current.subject}</h2>
            <p className="text-xs text-slate-400 mt-1">Created: {formatDate(current.created_at)}</p>
            <p className="text-xs text-slate-400">User ID: {current.user_id}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[current.status] || ''}`}>{current.status.replace(/_/g, ' ')}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[current.priority] || ''}`}>{current.priority}</span>
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-5">{current.description}</p>
        <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
            <select value={current.status} onChange={e => handleUpdateStatus(e.target.value)} disabled={updating} className={selectCls}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Priority</label>
            <select value={current.priority} onChange={e => handleUpdatePriority(e.target.value)} disabled={updating} className={selectCls}>
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Messages ({current.messages.length})</h3>
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {current.messages.length === 0 && <p className="text-slate-400 text-sm">No messages yet.</p>}
          {current.messages.map(msg => (
            <div key={msg.id} className={`p-3 rounded-xl text-sm ${
              msg.sender_type === 'provider'
                ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/40 ml-8'
                : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 mr-8'
            }`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-semibold ${ msg.sender_type === 'provider' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {msg.sender_type === 'provider' ? 'You' : 'Customer'}
                </span>
                <span className="text-xs text-slate-400">{formatDate(msg.created_at)}</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}
        </div>
        {current.status !== 'closed' && (
          <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…"
              className={`flex-1 resize-none ${inputCls}`} rows={2} />
            <button onClick={handleReply} disabled={updating || !replyText.trim()}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-sm font-medium self-end transition-colors">
              Reply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Ticket Detail (provider ↔ admin thread) ───────────────────────────

function AdminTicketDetail({
  ticket, onClose,
}: { ticket: SupportTicketWithMessages; onClose: () => void }) {
  const [replyText, setReplyText] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(ticket);

  const refresh = async () => {
    const data = await supportService.getAdminTicket(current.id);
    setCurrent(data);
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setUpdating(true);
    try { await supportService.replyAdminTicket(current.id, replyText); setReplyText(''); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setUpdating(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-sky-500 hover:text-sky-600 font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to list
      </button>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{current.subject}</h2>
            <p className="text-xs text-slate-400 mt-1">Created: {formatDate(current.created_at)}</p>
          </div>
          <div className="flex gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[current.status] || ''}`}>{current.status.replace(/_/g, ' ')}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[current.priority] || ''}`}>{current.priority}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{current.category}</span>
          </div>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{current.description}</p>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Messages ({current.messages.length})</h3>
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {current.messages.length === 0 && <p className="text-slate-400 text-sm">No messages yet.</p>}
          {current.messages.map(msg => (
            <div key={msg.id} className={`p-3 rounded-xl text-sm ${
              msg.sender_type === 'provider'
                ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/40 ml-8'
                : msg.sender_type === 'admin'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 mr-8'
                  : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 mr-8'
            }`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-semibold ${
                  msg.sender_type === 'provider' ? 'text-sky-600 dark:text-sky-400'
                  : msg.sender_type === 'admin' ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {msg.sender_type === 'provider' ? 'You' : msg.sender_type === 'admin' ? 'Admin' : 'Support'}
                </span>
                <span className="text-xs text-slate-400">{formatDate(msg.created_at)}</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}
        </div>
        {current.status !== 'closed' && (
          <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply to admin…"
              className={`flex-1 resize-none ${inputCls}`} rows={2} />
            <button onClick={handleReply} disabled={updating || !replyText.trim()}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-sm font-medium self-end transition-colors">
              Reply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ProviderSupportPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'trip' | 'admin'>('trip');

  // Trip tickets state
  const [statusFilter, setStatusFilter] = useState('');
  const [tripTickets, setTripTickets] = useState<TripSupportTicket[]>([]);
  const [tripTotal, setTripTotal] = useState(0);
  const [tripPage, setTripPage] = useState(1);
  const [selectedTripTicket, setSelectedTripTicket] = useState<TripSupportTicketWithMessages | null>(null);

  // Admin tickets state
  const [adminTickets, setAdminTickets] = useState<SupportTicket[]>([]);
  const [adminTotal, setAdminTotal] = useState(0);
  const [adminPage, setAdminPage] = useState(1);
  const [selectedAdminTicket, setSelectedAdminTicket] = useState<SupportTicketWithMessages | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ subject: '', description: '', category: 'general', priority: 'medium' });
  const [creating, setCreating] = useState(false);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<Error | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setTripPage(1); }, [statusFilter, activeTab]);
  useEffect(() => { if (activeTab === 'trip') loadTripTickets(); }, [statusFilter, tripPage, activeTab]);
  useEffect(() => { if (activeTab === 'admin') loadAdminTickets(); }, [adminPage, activeTab]);

  const loadTripTickets = async () => {
    setLoading(true); setError(null);
    try {
      const skip = (tripPage - 1) * PAGE_SIZE;
      const data = await supportService.listTickets(statusFilter || undefined, skip, PAGE_SIZE);
      setTripTickets(data);
      if (data.length < PAGE_SIZE && tripPage === 1) setTripTotal(data.length);
      else if (data.length < PAGE_SIZE) setTripTotal((tripPage - 1) * PAGE_SIZE + data.length);
      else setTripTotal(prev => Math.max(prev, tripPage * PAGE_SIZE + 1));
    } catch (err: any) {
      if (err instanceof PermissionDeniedError) setPageError(err);
      else setError(err.message || 'Failed to load tickets');
    } finally { setLoading(false); }
  };

  const loadAdminTickets = async () => {
    setLoading(true); setError(null);
    try {
      const skip = (adminPage - 1) * PAGE_SIZE;
      const data = await supportService.listAdminTickets(skip, PAGE_SIZE);
      setAdminTickets(data);
      if (data.length < PAGE_SIZE && adminPage === 1) setAdminTotal(data.length);
      else if (data.length < PAGE_SIZE) setAdminTotal((adminPage - 1) * PAGE_SIZE + data.length);
      else setAdminTotal(prev => Math.max(prev, adminPage * PAGE_SIZE + 1));
    } catch (err: any) {
      if (err instanceof PermissionDeniedError) setPageError(err);
      else setError(err.message || 'Failed to load tickets');
    } finally { setLoading(false); }
  };

  const openTripTicket = async (id: string) => {
    try { setSelectedTripTicket(await supportService.getTicket(id)); }
    catch (e: any) { setError(e.message); }
  };

  const openAdminTicket = async (id: string) => {
    try { setSelectedAdminTicket(await supportService.getAdminTicket(id)); }
    catch (e: any) { setError(e.message); }
  };

  const handleCreate = async () => {
    if (!createForm.subject.trim() || !createForm.description.trim()) return;
    setCreating(true);
    try {
      await supportService.createAdminTicket(createForm);
      setCreateForm({ subject: '', description: '', category: 'general', priority: 'medium' });
      setShowCreateForm(false);
      await loadAdminTickets();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  if (selectedTripTicket) return <TripTicketDetail ticket={selectedTripTicket} onClose={() => { setSelectedTripTicket(null); loadTripTickets(); }} />;
  if (selectedAdminTicket) return <AdminTicketDetail ticket={selectedAdminTicket} onClose={() => { setSelectedAdminTicket(null); loadAdminTickets(); }} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage customer tickets and contact admin support</p>
        </div>
        {activeTab === 'admin' && (
          <button onClick={() => setShowCreateForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Ticket to Admin
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button onClick={() => setActiveTab('trip')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'trip' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}>
          Customer Tickets
        </button>
        <button onClick={() => setActiveTab('admin')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'admin' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}>
          My Admin Tickets
        </button>
      </div>

      {/* Create admin ticket form */}
      {activeTab === 'admin' && showCreateForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">New Support Ticket to Admin</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject *</label>
              <input value={createForm.subject} onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Brief summary of the issue" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Description *</label>
              <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the issue in detail…" rows={4} className={`resize-none ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))} className={`w-full ${selectCls}`}>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
              <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))} className={`w-full ${selectCls}`}>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleCreate} disabled={creating || !createForm.subject.trim() || !createForm.description.trim()}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors">
              {creating ? 'Submitting…' : 'Submit Ticket'}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status filter (trip tab only) */}
      {activeTab === 'trip' && (
        <div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" /></div>
      ) : pageError instanceof PermissionDeniedError ? (
        <PermissionDenied action="view support tickets" />
      ) : activeTab === 'trip' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {tripTickets.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-sm">No customer tickets found.</p>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Priority</th>
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Created</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tripTickets.map(t => (
                    <tr key={t.id} onClick={() => openTripTicket(t.id)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">{t.subject}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[t.priority] || ''}`}>{t.priority}</span></td>
                      <td className="px-5 py-3.5"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || ''}`}>{t.status.replace(/_/g, ' ')}</span></td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs hidden md:table-cell">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 pb-4"><Pagination page={tripPage} pageSize={PAGE_SIZE} total={tripTotal} onPageChange={setTripPage} /></div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {adminTickets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm mb-3">You haven't raised any admin tickets yet.</p>
              <button onClick={() => setShowCreateForm(true)} className="text-sky-500 hover:text-sky-600 text-sm font-medium">Create your first ticket →</button>
            </div>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Category</th>
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-start px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Created</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adminTickets.map(t => (
                    <tr key={t.id} onClick={() => openAdminTicket(t.id)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">{t.subject}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell"><span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{t.category}</span></td>
                      <td className="px-5 py-3.5"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || ''}`}>{t.status.replace(/_/g, ' ')}</span></td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs hidden md:table-cell">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 pb-4"><Pagination page={adminPage} pageSize={PAGE_SIZE} total={adminTotal} onPageChange={setAdminPage} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderSupportPage;
