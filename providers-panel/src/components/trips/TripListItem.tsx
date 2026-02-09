import React from 'react';
import Link from 'next/link';
import { Trip } from '../../types/trip';

interface TripListItemProps {
  trip: Trip;
}

const TripListItem: React.FC<TripListItemProps> = ({ trip }) => {
  const hasPackages = trip.packages && trip.packages.length > 0;
  
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex justify-between items-center">
      <div>
        <h3 className="text-xl font-semibold">{trip.name_en}</h3>
        <p className="text-sm text-gray-500" dir="rtl">{trip.name_ar}</p>
        <p className="text-gray-600 dark:text-gray-400">Dates: {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}</p>
        <div className="flex items-center gap-4 mt-2">
          <p className={`text-sm font-medium ${trip.is_active ? 'text-green-600' : 'text-red-600'}`}>
            Status: {trip.is_active ? 'Active' : 'Inactive'}
          </p>
          <p className={`text-sm font-medium ${hasPackages ? 'text-blue-600' : 'text-orange-600'}`}>
            Packages: {hasPackages ? `${trip.packages.length} configured` : 'None (Required!)'}
          </p>
        </div>
        {hasPackages && (
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Package prices: {trip.packages.map(pkg => `${pkg.price} ${pkg.currency || 'SAR'}`).join(', ')}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Link href={`/trips/${trip.id}`}>
          <a className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-center">
            View Details
          </a>
        </Link>
        {!hasPackages && (
          <span className="text-xs text-orange-600 text-center">
            Add packages required
          </span>
        )}
      </div>
    </div>
  );
};

export default TripListItem;
