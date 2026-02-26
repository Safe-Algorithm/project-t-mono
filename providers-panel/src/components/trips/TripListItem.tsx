import React from 'react';
import Link from 'next/link';
import { Trip } from '../../types/trip';
import { formatDateInTripTz, tzLabel } from '../../utils/tripDate';

interface TripListItemProps {
  trip: Trip;
}

const TripListItem: React.FC<TripListItemProps> = ({ trip }) => {
  const hasPackages = trip.packages && trip.packages.length > 0;
  const isPackaged = trip.is_packaged_trip;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex justify-between items-center">
      <div>
        <h3 className="text-xl font-semibold">{trip.name_en || trip.name_ar}</h3>
        {trip.name_ar && trip.name_en && (
          <p className="text-sm text-gray-500" dir="rtl">{trip.name_ar}</p>
        )}
        <p className="text-gray-600 dark:text-gray-400">
          Dates: {formatDateInTripTz(trip.start_date, trip.timezone ?? 'Asia/Riyadh')} – {formatDateInTripTz(trip.end_date, trip.timezone ?? 'Asia/Riyadh')} <span className="text-xs text-gray-400">({tzLabel(trip.timezone ?? 'Asia/Riyadh')})</span>
        </p>
        <div className="flex items-center gap-4 mt-2">
          <p className={`text-sm font-medium ${trip.is_active ? 'text-green-600' : 'text-red-600'}`}>
            Status: {trip.is_active ? 'Active' : 'Inactive'}
          </p>
          {!isPackaged ? (
            <p className="text-sm font-medium text-blue-600">
              Simple Trip · {trip.price ? `${Number(trip.price).toLocaleString()} SAR` : 'Price not set'}
            </p>
          ) : (
            <p className={`text-sm font-medium ${hasPackages ? 'text-blue-600' : 'text-orange-600'}`}>
              {hasPackages ? `${trip.packages.length} package(s)` : 'No packages configured'}
            </p>
          )}
        </div>
        {isPackaged && hasPackages && (
          <p className="text-sm text-gray-500 mt-1">
            Prices: {trip.packages.map(pkg => `${Number(pkg.price).toLocaleString()} ${pkg.currency || 'SAR'}`).join(' · ')}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Link href={`/trips/${trip.id}`}>
          <a className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-center">
            View Details
          </a>
        </Link>
        {isPackaged && !hasPackages && (
          <span className="text-xs text-orange-600 text-center">Add packages</span>
        )}
      </div>
    </div>
  );
};

export default TripListItem;
