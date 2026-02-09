import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { tripUpdateService, TripUpdate, TripUpdateCreate, TripUpdateReceipt } from '../services/tripUpdateService';
import { api } from '../services/api';

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

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
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
      setError(err.message);
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
      const payload: TripUpdateCreate = { title, message, is_important: isImportant };
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
  const getTripName = (trip: TripOption) => trip.name_en || trip.name_ar || 'Unnamed Trip';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{t('tripUpdates.title')}</h1>
      <p className="text-gray-500 mb-6 text-sm">{t('tripUpdates.subtitle')}</p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">{t('common.dismiss')}</button>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 underline">{t('common.dismiss')}</button>
        </div>
      )}

      {/* Trip selector */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">{t('tripUpdates.selectTrip')}</label>
          <select
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 min-w-[250px]"
          >
            {trips.map(trip => (
              <option key={trip.id} value={trip.id}>{getTripName(trip)}</option>
            ))}
          </select>
        </div>
        <div className="self-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            {showForm ? t('tripUpdates.cancel') : t('tripUpdates.sendUpdate')}
          </button>
        </div>
      </div>

      {/* Send form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('tripUpdates.sendNew')}</h3>

          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={sendTo === 'all'}
                onChange={() => setSendTo('all')}
                className="text-blue-600"
              />
              <span className="text-sm">{t('tripUpdates.allRegistered')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={sendTo === 'registration'}
                onChange={() => setSendTo('registration')}
                className="text-blue-600"
              />
              <span className="text-sm">{t('tripUpdates.specificRegistration')}</span>
            </label>
          </div>

          {sendTo === 'registration' && (
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-600 block mb-1">{t('tripUpdates.registration')}</label>
              <select
                value={selectedRegId}
                onChange={(e) => setSelectedRegId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">{t('tripUpdates.selectRegistration')}</option>
                {registrations.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.id.slice(0, 8)}... — User: {r.user_id.slice(0, 8)}... ({r.total_participants} participant{r.total_participants > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-600 block mb-1">{t('tripUpdates.titleLabel')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tripUpdates.titlePlaceholder')}
              className="border rounded-lg px-3 py-2 text-sm w-full dark:bg-gray-700 dark:border-gray-600"
              maxLength={255}
            />
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-600 block mb-1">{t('tripUpdates.messageLabel')}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('tripUpdates.messagePlaceholder')}
              className="border rounded-lg px-3 py-2 text-sm w-full dark:bg-gray-700 dark:border-gray-600 resize-none"
              rows={4}
              maxLength={5000}
            />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isImportant}
                onChange={(e) => setIsImportant(e.target.checked)}
                className="text-red-600"
              />
              <span className="text-sm font-medium text-red-600">{t('tripUpdates.markImportant')}</span>
            </label>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            {sending ? t('tripUpdates.sending') : t('tripUpdates.send')}
          </button>
        </div>
      )}

      {/* Updates list */}
      {loading ? (
        <p className="text-gray-500">{t('tripUpdates.loading')}</p>
      ) : (
        <div className="space-y-4">
          {updates.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-gray-500 text-center">
              {t('tripUpdates.noUpdates')}
            </div>
          ) : (
            updates.map((u) => (
              <div key={u.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-lg">{u.title}</h4>
                    {u.is_important && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">{t('tripUpdates.important')}</span>
                    )}
                    {u.registration_id && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">{t('tripUpdates.targeted')}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(u.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">{u.message}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{t('tripUpdates.recipients')}: {u.total_recipients ?? '—'}</span>
                  <span>{t('tripUpdates.read')}: {u.read_count ?? 0}</span>
                  <button
                    onClick={() => viewReceipts(u.id)}
                    className="text-blue-600 hover:underline"
                  >
                    {selectedUpdateId === u.id ? t('tripUpdates.hideReceipts') : t('tripUpdates.viewReceipts')}
                  </button>
                </div>
                {selectedUpdateId === u.id && selectedReceipts && (
                  <div className="mt-3 border-t pt-3">
                    {selectedReceipts.length === 0 ? (
                      <p className="text-xs text-gray-400">{t('tripUpdates.noReads')}</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedReceipts.map(r => (
                          <div key={r.id} className="text-xs text-gray-500">
                            {t('tripUpdates.user')} {r.user_id.slice(0, 8)}... — {t('tripUpdates.readAt')} {formatDate(r.read_at)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TripUpdatesPage;
