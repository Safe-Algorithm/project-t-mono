import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { tripUpdateService, TripUpdate } from '../services/tripUpdateService';

const TripUpdatesPage = () => {
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
      <h1 className="text-3xl font-bold mb-2">Trip Updates</h1>
      <p className="text-gray-500 mb-6 text-sm">All updates sent by providers to their trip registrants.</p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading updates...</p>
      ) : updates.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-gray-500 text-center">
          No trip updates found.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Target</th>
                <th className="text-left px-4 py-3 font-medium">Trip ID</th>
                <th className="text-left px-4 py-3 font-medium">Read</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {updates.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.title}</span>
                      {u.is_important && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Important</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{u.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.registration_id ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                        Specific user
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">
                        All users
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
