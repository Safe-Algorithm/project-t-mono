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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{t('tripUpdates.title')}</h1>
      <p className="text-gray-500 mb-6 text-sm">{t('tripUpdates.subtitle')}</p>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">{t('common.dismiss')}</button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">{t('tripUpdates.loading')}</p>
      ) : updates.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-gray-500 text-center">
          {t('tripUpdates.noUpdates')}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t('tripUpdates.titleCol')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('tripUpdates.target')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('tripUpdates.tripId')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('tripUpdates.readCol')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('tripUpdates.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {updates.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.title}</span>
                      {u.is_important && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">{t('tripUpdates.important')}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{u.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.registration_id ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                        {t('tripUpdates.specificUser')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">
                        {t('tripUpdates.allUsers')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/trips/${u.trip_id}`} className="text-blue-600 hover:underline text-xs">
                      {u.trip_id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.read_count} / {u.total_recipients}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TripUpdatesPage;
