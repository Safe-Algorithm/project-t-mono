import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { tripUpdateService, TripUpdate, TripUpdateCreate, TripUpdateReceipt } from '../services/tripUpdateService';
import { api, PermissionDeniedError } from '../services/api';
import PermissionDenied from '../components/common/PermissionDenied';

interface TripOption {
  id: string;
  name_en: string | null;
  name_ar: string | null;
}

interface RegistrationOption {
  id: string;
  user_id: string;
  total_participants: number;
  status: string;
}

const TripUpdatesPage = () => {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [updates, setUpdates] = useState<TripUpdate[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationOption[]>([]);
  const [selectedReceipts, setSelectedReceipts] = useState<TripUpdateReceipt[] | null>(null);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [sendTo, setSendTo] = useState<'all' | 'registration'>('all');
  const [selectedRegId, setSelectedRegId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState<Error | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTrips();
  }, []);

  useEffect(() => {
    if (selectedTripId) {
      loadUpdates();
      loadRegistrations();
    }
  }, [selectedTripId]);

  const loadTrips = async () => {
    try {
      const data = await api.get<TripOption[]>('/trips');
      setTrips(data);
      if (data.length > 0) {
        setSelectedTripId(data[0].id);
      }
    } catch (err: any) {
      if (err instanceof PermissionDeniedError) {
        setPageError(err);
      } else {
        setError(err.message);
      }
    }
  };

  const loadUpdates = async () => {
    if (!selectedTripId) return;
    setLoading(true);
    try {
      const data = await tripUpdateService.listForTrip(selectedTripId);
      setUpdates(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrations = async () => {
    if (!selectedTripId) return;
    try {
      const data = await api.get<RegistrationOption[]>(`/trips/${selectedTripId}/registrations`);
      setRegistrations(data);
    } catch (err: any) {
      // Registrations endpoint may not exist yet, ignore
      setRegistrations([]);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: TripUpdateCreate = { title, message, is_important: isImportant, file: attachedFile };
      if (sendTo === 'all') {
        await tripUpdateService.sendToAll(selectedTripId, payload);
      } else {
        if (!selectedRegId) {
          setError(t('tripUpdates.selectRegistration'));
          setSending(false);
          return;
        }
        await tripUpdateService.sendToRegistration(selectedRegId, payload);
      }
      setSuccess(t('tripUpdates.sentSuccess'));
      setTitle('');
      setMessage('');
      setIsImportant(false);
      setAttachedFile(null);
      setShowForm(false);
      await loadUpdates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const viewReceipts = async (updateId: string) => {
    if (selectedUpdateId === updateId) {
      setSelectedReceipts(null);
      setSelectedUpdateId(null);
      return;
    }
    try {
      const data = await tripUpdateService.getReceipts(updateId);
      setSelectedReceipts(data);
      setSelectedUpdateId(updateId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const getTripName = (trip: TripOption) => trip.name_en || trip.name_ar || t('tripUpdates.unnamedTrip');

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition text-sm";
  const selectCls = "px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition";

  if (pageError instanceof PermissionDeniedError) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('tripUpdates.title')}</h1>
        </div>
        <PermissionDenied action="view trip updates" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('tripUpdates.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('tripUpdates.subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="underline text-xs">{t('common.dismiss')}</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-600 dark:text-emerald-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess(null)} className="underline text-xs">{t('common.dismiss')}</button>
        </div>
      )}

      {/* Trip selector + send button */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">{t('tripUpdates.selectTrip')}</label>
          <select value={selectedTripId} onChange={e => setSelectedTripId(e.target.value)} className={`${selectCls} w-full`}>
            {trips.map(trip => <option key={trip.id} value={trip.id}>{getTripName(trip)}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${showForm ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700' : 'bg-sky-500 hover:bg-sky-600 text-white'}`}>
          {showForm ? t('tripUpdates.cancel') : t('tripUpdates.sendUpdate')}
        </button>
      </div>

      {/* Send form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('tripUpdates.sendNew')}</h3>

          <div className="flex gap-5">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
              <input type="radio" checked={sendTo === 'all'} onChange={() => setSendTo('all')} className="accent-sky-500" />
              {t('tripUpdates.allRegistered')}
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
              <input type="radio" checked={sendTo === 'registration'} onChange={() => setSendTo('registration')} className="accent-sky-500" />
              {t('tripUpdates.specificRegistration')}
            </label>
          </div>

          {sendTo === 'registration' && (
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">{t('tripUpdates.registration')}</label>
              <select value={selectedRegId} onChange={e => setSelectedRegId(e.target.value)} className={`${selectCls} w-full`}>
                <option value="">{t('tripUpdates.selectRegistration')}</option>
                {registrations.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.total_participants > 1
                      ? t('tripUpdates.registrationOptionPlural', { id: r.id.slice(0, 8), user: r.user_id.slice(0, 8), count: r.total_participants })
                      : t('tripUpdates.registrationOption', { id: r.id.slice(0, 8), user: r.user_id.slice(0, 8), count: r.total_participants })}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">{t('tripUpdates.titleLabel')}</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('tripUpdates.titlePlaceholder')} className={inputCls} maxLength={255} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">{t('tripUpdates.messageLabel')}</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t('tripUpdates.messagePlaceholder')}
              className={`${inputCls} resize-none`} rows={4} maxLength={5000} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">{t('tripUpdates.attachmentLabel')} <span className="text-slate-400">{t('tripUpdates.attachmentOptional')}</span></label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer hover:border-sky-400 dark:hover:border-sky-500 transition-colors text-sm text-slate-600 dark:text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                {attachedFile ? attachedFile.name : t('tripUpdates.chooseFile')}
                <input type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => setAttachedFile(e.target.files?.[0] ?? null)} />
              </label>
              {attachedFile && (
                <button onClick={() => setAttachedFile(null)} className="text-xs text-red-500 hover:text-red-700 font-medium">{t('tripUpdates.removeAttachment')}</button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-red-600 dark:text-red-400">
              <input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="accent-red-500" />
              {t('tripUpdates.markImportant')}
            </label>
            <button onClick={handleSend} disabled={sending || !title.trim() || !message.trim()}
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {sending ? t('tripUpdates.sending') : t('tripUpdates.send')}
            </button>
          </div>
        </div>
      )}

      {/* Updates list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
        </div>
      ) : updates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">{t('tripUpdates.noUpdates')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map(u => (
            <div key={u.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-slate-900 dark:text-white">{u.title}</h4>
                  {u.is_important && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">{t('tripUpdates.important')}</span>}
                  {u.registration_id && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium">{t('tripUpdates.targeted')}</span>}
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{formatDate(u.created_at)}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap mb-3 leading-relaxed">{u.message}</p>
              {u.attachments && u.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {u.attachments.map((att: any, i: number) => (
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url) ? (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer">
                        <img src={att.url} alt={att.filename} className="h-20 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-cover hover:opacity-80 transition-opacity" />
                      </a>
                    ) : (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-sky-600 dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {att.filename || 'Attachment'}
                      </a>
                    )
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span>{t('tripUpdates.recipients')}: {u.total_recipients ?? '—'}</span>
                <span>{t('tripUpdates.read')}: {u.read_count ?? 0}</span>
                <button onClick={() => viewReceipts(u.id)} className="text-sky-500 hover:text-sky-600 font-medium transition-colors">
                  {selectedUpdateId === u.id ? t('tripUpdates.hideReceipts') : t('tripUpdates.viewReceipts')}
                </button>
              </div>
              {selectedUpdateId === u.id && selectedReceipts && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {selectedReceipts.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t('tripUpdates.noReads')}</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedReceipts.map(r => (
                        <div key={r.id} className="text-xs text-slate-500 dark:text-slate-400">
                          {t('tripUpdates.user')} {r.user_id.slice(0, 8)}... — {t('tripUpdates.readAt')} {formatDate(r.read_at)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TripUpdatesPage;
