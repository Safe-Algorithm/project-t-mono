import React from 'react';
import { Trip } from '../../types/trip';
import TripListItem from './TripListItem';

interface TripListProps {
  trips: Trip[];
}

const TripList: React.FC<TripListProps> = ({ trips }) => {
  if (trips.length === 0) {
    return <p className="text-gray-500">No trips found. Get started by creating one!</p>;
  }

  return (
    <div className="space-y-4">
      {trips.map((trip) => (
        <TripListItem key={trip.id} trip={trip} />
      ))}
    </div>
  );
};

export default TripList;
