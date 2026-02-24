import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

interface Provider {
  id: string;
  company_name: string;
}

interface TripPackage {
  id: string;
  name_en: string;
  name_ar: string;
  price: number;
  currency: string;
}

interface Trip {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  is_active: boolean;
  provider_id: string;
  provider: Provider;
  packages: TripPackage[];
}

const TripsPage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  // Filter states
  const [search, setSearch] = useState('');
  const [providerName, setProviderName] = useState('');
  const [startDateFrom, setStartDateFrom] = useState('');
  const [startDateTo, setStartDateTo] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minParticipants, setMinParticipants] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [minRating, setMinRating] = useState(1);
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [isActive, setIsActive] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchTrips = async () => {
      try {
        // Build query params
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (providerName) params.append('provider_name', providerName);
        if (startDateFrom) params.append('start_date_from', new Date(startDateFrom).toISOString());
        if (startDateTo) params.append('start_date_to', new Date(startDateTo).toISOString());
        if (minPrice) params.append('min_price', minPrice);
        if (maxPrice) params.append('max_price', maxPrice);
        if (minParticipants) params.append('min_participants', minParticipants);
        if (maxParticipants) params.append('max_participants', maxParticipants);
        if (ratingEnabled) params.append('min_rating', minRating.toString());
        if (isActive !== 'all') params.append('is_active', isActive);

        const queryString = params.toString();
        const url = `/admin/trips${queryString ? `?${queryString}` : ''}`;
        
        const data = await api.get<Trip[]>(url);
        setTrips(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [token, search, providerName, startDateFrom, startDateTo, minPrice, maxPrice, minParticipants, maxParticipants, minRating, ratingEnabled, isActive]);

  const handleClearFilters = () => {
    setSearch('');
    setProviderName('');
    setStartDateFrom('');
    setStartDateTo('');
    setMinPrice('');
    setMaxPrice('');
    setMinParticipants('');
    setMaxParticipants('');
    setMinRating(1);
    setRatingEnabled(false);
    setIsActive('all');
  };

  const { t } = useTranslation();
  const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition";
  const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );
  if (error) return (
    <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error}</div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav.trips')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('trips.totalCount_other', { count: trips.length })}</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${showFilters ? 'bg-sky-500 text-white border-sky-500' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          {showFilters ? t('common.close') : t('common.filter', 'Filters')}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t('common.search')}</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.searchPlaceholder', 'Name or description…')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('nav.providers')}</label>
              <input type="text" value={providerName} onChange={e => setProviderName(e.target.value)} placeholder="Provider…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('common.status')}</label>
              <select value={isActive} onChange={e => setIsActive(e.target.value)} className={inputCls}>
                <option value="all">{t('common.all')}</option>
                <option value="true">{t('status.active')}</option>
                <option value="false">{t('status.inactive')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Start Date From</label>
              <input type="date" value={startDateFrom} onChange={e => setStartDateFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start Date To</label>
              <input type="date" value={startDateTo} onChange={e => setStartDateTo(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Min Price</label>
                <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Max Price</label>
                <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="∞" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Min Seats</label>
                <input type="number" value={minParticipants} onChange={e => setMinParticipants(e.target.value)} placeholder="1" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Max Seats</label>
                <input type="number" value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} placeholder="∞" className={inputCls} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls + ' mb-0'}>Min Rating</label>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={ratingEnabled} onChange={e => setRatingEnabled(e.target.checked)} className="accent-sky-500" />
                  Enable
                </label>
              </div>
              {ratingEnabled && (
                <div className="space-y-1">
                  <input type="range" min="1" max="5" step="0.5" value={minRating} onChange={e => setMinRating(parseFloat(e.target.value))} className="w-full accent-sky-500" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">{minRating.toFixed(1)} stars & above</p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button onClick={handleClearFilters} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              {t('common.clearFilters', 'Clear All Filters')}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No trips found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('trips.colTrip')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">{t('nav.providers')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">{t('trips.colDates')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">{t('trips.colPrice')}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('trips.colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trips.map(trip => (
                  <tr
                    key={trip.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => router.push(`/trips/${trip.id}`)}
                  >
                    <td className="py-3 px-4">
                      <p className="font-semibold text-sky-600 dark:text-sky-400 group-hover:text-sky-700 dark:group-hover:text-sky-300">{trip.name_en || trip.name_ar}</p>
                      {trip.name_ar && trip.name_en && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" dir="rtl">{trip.name_ar}</p>}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell" onClick={e => { e.stopPropagation(); router.push(`/providers/${trip.provider.id}`); }}>
                      <span className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer">{trip.provider.company_name}</span>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <p className="text-slate-600 dark:text-slate-300 text-xs">{new Date(trip.start_date).toLocaleDateString()}</p>
                      <p className="text-slate-400 dark:text-slate-500 text-xs">{new Date(trip.end_date).toLocaleDateString()}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 hidden lg:table-cell">
                      {trip.packages.length > 0
                        ? trip.packages.map(p => `${p.price} ${p.currency || 'SAR'}`).join(', ')
                        : <span className="text-slate-400 dark:text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${trip.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        {trip.is_active ? t('status.active') : t('status.inactive')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripsPage;
