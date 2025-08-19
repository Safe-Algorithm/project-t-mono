import React from 'react';
import Link from 'next/link';
import { Trip } from '../../types/trip';

interface TripListItemProps {
  trip: Trip;
}

const TripListItem: React.FC<TripListItemProps> = ({ trip }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center">
      <div>
        <h3 className="text-xl font-semibold">{trip.name}</h3>
        <p className="text-gray-600">Price: ${trip.price}</p>
        <p className="text-gray-600">Dates: {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}</p>
        <p className={`text-sm font-medium ${trip.is_active ? 'text-green-600' : 'text-red-600'}`}>
          Status: {trip.is_active ? 'Active' : 'Inactive'}
        </p>
      </div>
      <Link href={`/trips/${trip.id}`}>
        <a className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
          View Details
        </a>
      </Link>
    </div>
  );
};

export default TripListItem;
