import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { tripUpdateService, TripUpdate } from '../services/tripUpdateService';

const TripUpdatesPage = () => {
  const { t } = useTranslation();
  const [updates, setUpdates] = useState<TripUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tripUpdateService.listAll();
      setUpdates(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load trip updates');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  const thCls = "text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('tripUpdates.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('tripUpdates.subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:opacity-70 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-7 h-7 rounded-full border-4 border-sky-500 border-t-transparent" />
        </div>
      ) : updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('tripUpdates.noUpdates')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className={thCls}>{t('tripUpdates.titleCol')}</th>
                  <th className={`${thCls} hidden sm:table-cell`}>{t('tripUpdates.target')}</th>
                  <th className={`${thCls} hidden md:table-cell`}>{t('tripUpdates.tripId')}</th>
                  <th className={`${thCls} hidden lg:table-cell`}>{t('tripUpdates.readCol')}</th>
                  <th className={`${thCls} hidden lg:table-cell`}>{t('tripUpdates.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {updates.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-white">{u.title}</span>
                        {u.is_important && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            {t('tripUpdates.important')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{u.message}</p>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      {u.registration_id ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
                          {t('tripUpdates.specificUser')}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">
                          {t('tripUpdates.allUsers')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <Link href={`/trips/${u.trip_id}`} className="text-sky-600 dark:text-sky-400 hover:text-sky-700 text-xs font-mono">
                        {u.trip_id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs hidden lg:table-cell">
                      {u.read_count} / {u.total_recipients}
                    </td>
                    <td className="py-3 px-4 text-slate-400 dark:text-slate-500 text-xs hidden lg:table-cell">
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripUpdatesPage;
