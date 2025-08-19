import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import TripForm from '../../components/trips/TripForm';
import { tripService, TripUpdatePayload } from '../../services/tripService';
import { Trip } from '../../types/trip';

const TripDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof id === 'string') {
      const fetchTrip = async () => {
        try {
          setIsLoading(true);
          const fetchedTrip = await tripService.getById(id);
          setTrip(fetchedTrip);
        } catch (err) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('An unknown error occurred while fetching trip details.');
          }
        } finally {
          setIsLoading(false);
        }
      };
      fetchTrip();
    }
  }, [id]);

  const handleSubmit = async (payload: TripUpdatePayload) => {
    if (!id || typeof id !== 'string') return;
    setIsSubmitting(true);
    setError(null);
    try {
      await tripService.update(id, payload);
      router.push('/trips');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred while updating the trip.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id || typeof id !== 'string') return;
    if (window.confirm('Are you sure you want to delete this trip?')) {
        setIsSubmitting(true);
        setError(null);
        try {
            await tripService.delete(id);
            router.push('/trips');
        } catch (err) {
            if (err instanceof Error) {
              setError(err.message);
            } else {
              setError('An unknown error occurred while deleting the trip.');
            }
        } finally {
            setIsSubmitting(false);
        }
    }
  };

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!trip) return <p>Trip not found.</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Edit Trip</h1>
        <button onClick={handleDelete} disabled={isSubmitting} style={{ backgroundColor: 'red', color: 'white' }}>
          Delete Trip
        </button>
      </div>
      <TripForm trip={trip} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
};

export default TripDetailPage;
