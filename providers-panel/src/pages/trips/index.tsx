import React from 'react';
import Link from 'next/link';
import { useTrips } from '../../hooks/useTrips';
import TripList from '../../components/trips/TripList';

const TripsPage = () => {
  const { trips, isLoading, error } = useTrips();

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <Link href="/trips/new">
          <a className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Create New Trip
          </a>
        </Link>
      </div>

      {isLoading && <p>Loading trips...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!isLoading && !error && <TripList trips={trips} />}
    </div>
  );
};

export default TripsPage;
