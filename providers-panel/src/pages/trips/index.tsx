import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { tripService, TripFilterParams } from '../../services/tripService';
import { PermissionDeniedError } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { Trip } from '../../types/trip';
import Pagination from '../../components/ui/Pagination';
import PermissionDenied from '../../components/common/PermissionDenied';

const PAGE_SIZE = 20;

function TripStatusBadge({ isActive }: { isActive: boolean; isRTL: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
      isActive
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {isActive ? t('trips.filterActive') : t('trips.filterInactive')}
    </span>
  );
}

const TripsPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getTripName = (trip: Trip) =>
    (isRTL ? trip.name_ar || trip.name_en : trip.name_en || trip.name_ar) || '—';

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getMinPrice = (trip: Trip): string => {
    if (trip.price != null) return `${Number(trip.price).toLocaleString()} SAR`;
    if (!trip.packages?.length) return '—';
    const min = Math.min(...trip.packages.map(p => Number(p.price)));
    return `${min.toLocaleString()} SAR`;
  };

  useEffect(() => {
    const fetchPage = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const filters: TripFilterParams = {
          search: search || undefined,
          is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
          skip: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        };
        const data = await tripService.getAll(filters);
        setTrips(data);
        if (data.length < PAGE_SIZE && page === 1) {
          setTotal(data.length);
        } else if (data.length < PAGE_SIZE) {
          setTotal((page - 1) * PAGE_SIZE + data.length);
        } else {
          setTotal(prev => Math.max(prev, page * PAGE_SIZE + 1));
        }
      } catch (err: any) {
        setError(err instanceof Error ? err : new Error(err?.message || 'Failed to fetch trips'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchPage();
  }, [search, statusFilter, page]);

  const handleFilterChange = (newSearch: string, newStatus: 'all' | 'active' | 'inactive') => {
    setPage(1);
    setSearch(newSearch);
    setStatusFilter(newStatus);
  };

  const filtered = trips;

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('trips.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('trips.totalCount_other', { count: trips.length })}
          </p>
        </div>
        <Link
          href="/trips/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('trips.createNew')}
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => handleFilterChange(e.target.value, statusFilter)}
            placeholder={t('trips.searchPlaceholder')}
            className={`w-full ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition`}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleFilterChange(search, s)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                statusFilter === s
                  ? 'bg-sky-500 text-white border-sky-500'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {s === 'all' ? t('trips.filterAll') : s === 'active' ? t('trips.filterActive') : t('trips.filterInactive')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
          </div>
        ) : error instanceof PermissionDeniedError ? (
          <div className="p-8">
            <PermissionDenied action="view trips" />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-500 dark:text-red-400 text-sm">{error.message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-14 h-14 text-slate-300 dark:text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">{t('trips.noTrips')}</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">
              {t('trips.getStarted')}
            </p>
            <Link href="/trips/new" className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('trips.createNew')}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>

                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-start px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t('trips.colTrip')}
                  </th>
                  <th className="text-start px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">
                    {t('trips.colDates')}
                  </th>
                  <th className="text-start px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">
                    {t('trips.colPrice')}
                  </th>
                  <th className="text-start px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">
                    {t('trips.colSeats')}
                  </th>
                  <th className="text-start px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t('trips.colStatus')}
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(trip => (
                  <tr
                    key={trip.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => window.location.href = `/trips/${trip.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {trip.images?.[0] ? (
                          <img src={trip.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">{getTripName(trip)}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {trip.is_packaged_trip ? t('trips.typePackaged') : t('trips.typeSimple')}
                            {trip.packages?.length ? ` · ${trip.packages.length} ${t('trips.pkg')}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                      <p>{formatDate(trip.start_date)}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(trip.end_date)}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium hidden sm:table-cell">
                      {getMinPrice(trip)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                      {trip.max_participants}
                    </td>
                    <td className="px-6 py-4">
                      <TripStatusBadge isActive={trip.is_active} isRTL={isRTL} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <Link href={`/trips/${trip.id}`} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium text-xs">
                          {t('common.view')}
                        </Link>
                        <Link href={`/trips/${trip.id}/edit`} className="text-sky-500 hover:text-sky-600 font-medium text-xs">
                          {t('common.edit')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 pb-4">
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripsPage;
