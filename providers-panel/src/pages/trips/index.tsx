import React, { useState } from 'react';
import Link from 'next/link';
import { useTrips } from '../../hooks/useTrips';
import TripList from '../../components/trips/TripList';
import TripFilters from '../../components/trips/TripFilters';
import { TripFilterParams } from '../../services/tripService';

const TripsPage = () => {
  const [filters, setFilters] = useState<TripFilterParams>({});
  const { trips, isLoading, error } = useTrips(filters);

  const handleFilterChange = (newFilters: TripFilterParams) => {
    setFilters(newFilters);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <Link href="/trips/new">
          <a className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Create New Trip
          </a>
        </Link>
      </div>

      <TripFilters onFilterChange={handleFilterChange} />

      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Showing {trips.length} trip{trips.length !== 1 ? 's' : ''}
      </div>

      {isLoading && <p>Loading trips...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!isLoading && !error && <TripList trips={trips} />}
    </div>
  );
};

export default TripsPage;
