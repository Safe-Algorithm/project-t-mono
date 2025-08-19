import React, { useState } from 'react';
import { useRouter } from 'next/router';
import TripForm from '../../components/trips/TripForm';
import { tripService, TripCreatePayload, TripUpdatePayload } from '../../services/tripService';

const NewTripPage = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (payload: TripCreatePayload | TripUpdatePayload) => {
    setIsSubmitting(true);
    setError(null);
    try {
            await tripService.create(payload as TripCreatePayload);
      router.push('/trips');
    } catch (err: any) {
      setError(err.message || 'Failed to create trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Create New Trip</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <TripForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
};

export default NewTripPage;
