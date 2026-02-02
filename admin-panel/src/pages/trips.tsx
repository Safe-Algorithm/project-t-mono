import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { useRouter } from 'next/router';

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

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">All Trips</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Search and Filter Section */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Provider Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider Name
              </label>
              <input
                type="text"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="Search by provider name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Start Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date From
              </label>
              <input
                type="date"
                value={startDateFrom}
                onChange={(e) => setStartDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Start Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date To
              </label>
              <input
                type="date"
                value={startDateTo}
                onChange={(e) => setStartDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Price
                </label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Price
                </label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Participants Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Participants
                </label>
                <input
                  type="number"
                  value={minParticipants}
                  onChange={(e) => setMinParticipants(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Participants
                </label>
                <input
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Min Rating */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Minimum Rating
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ratingEnabled}
                    onChange={(e) => setRatingEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Enable</span>
                </label>
              </div>
              {ratingEnabled && (
                <div className="space-y-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={minRating}
                    onChange={(e) => setMinRating(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>⭐ {minRating.toFixed(1)} stars & above</span>
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={isActive}
                onChange={(e) => setIsActive(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="mt-4">
            <button
              onClick={handleClearFilters}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {trips.length} trip{trips.length !== 1 ? 's' : ''}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Trip Name</th>
              <th className="py-2 px-4 border-b">Provider</th>
              <th className="py-2 px-4 border-b">Start Date</th>
              <th className="py-2 px-4 border-b">End Date</th>
              <th className="py-2 px-4 border-b">Price</th>
              <th className="py-2 px-4 border-b">Status</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr 
                key={trip.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/trips/${trip.id}`)}
              >
                <td className="py-2 px-4 border-b text-blue-600 hover:text-blue-800">
                  <div>{trip.name_en}</div>
                  <div className="text-xs text-gray-500" dir="rtl">{trip.name_ar}</div>
                </td>
                <td className="py-2 px-4 border-b text-blue-600 hover:text-blue-800 cursor-pointer" onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/providers/${trip.provider.id}`);
                }}>{trip.provider.company_name}</td>
                <td className="py-2 px-4 border-b">{new Date(trip.start_date).toLocaleDateString()}</td>
                <td className="py-2 px-4 border-b">{new Date(trip.end_date).toLocaleDateString()}</td>
                <td className="py-2 px-4 border-b">
                  {trip.packages.length > 0 ? 
                    trip.packages.map(pkg => `${pkg.price} ${pkg.currency || 'SAR'}`).join(', ') : 
                    'No packages'
                  }
                </td>
                <td className="py-2 px-4 border-b">{trip.is_active ? 'Active' : 'Cancelled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TripsPage;
