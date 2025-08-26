import React, { useState } from 'react';
import { useRouter } from 'next/router';
import TripForm from '../../components/trips/TripForm';
import { tripService, TripCreatePayload, TripUpdatePayload } from '../../services/tripService';
import { CreateTripPackage, PackageRequiredField } from '../../types/trip';

const NewTripPage = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (
    payload: TripCreatePayload | TripUpdatePayload, 
    packages?: CreateTripPackage[], 
    packageFields?: { [index: number]: string[] }
  ) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Create the trip first
      const createdTrip = await tripService.create(payload as TripCreatePayload);
      
      // Create packages and their required fields
      if (packages && packages.length > 0) {
        for (let i = 0; i < packages.length; i++) {
          const packageData = packages[i];
          const createdPackage = await tripService.createPackage(createdTrip.id, packageData);
          
          // Set required fields for this package if any are selected
          const selectedFields = packageFields?.[i] || [];
          if (selectedFields.length > 0) {
            const fields: PackageRequiredField[] = selectedFields.map(fieldName => ({ field_type: fieldName }));
            await tripService.setPackageRequiredFields(createdTrip.id, createdPackage.id, fields);
          }
        }
      }
      
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
