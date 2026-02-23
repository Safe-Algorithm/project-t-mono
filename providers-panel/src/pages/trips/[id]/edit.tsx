import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import TripForm from '../../../components/trips/TripForm';
import { tripService, TripUpdatePayload } from '../../../services/tripService';
import { Trip, CreateTripPackage, PackageRequiredField, ValidationConfig } from '../../../types/trip';

const TripEditPage = () => {
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

  const handleSubmit = async (
    payload: TripUpdatePayload, 
    packages?: CreateTripPackage[] | null, 
    packageFields?: { [index: number]: string[] },
    validationConfigs?: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } },
    imageData?: { newImages: File[], imagesToDelete: string[] }
  ) => {
    if (!id || typeof id !== 'string') return;
    setIsSubmitting(true);
    setError(null);

    try {
      await tripService.update(id, payload);
      
      // Handle image deletions
      if (imageData?.imagesToDelete && imageData.imagesToDelete.length > 0) {
        for (const imageUrl of imageData.imagesToDelete) {
          try {
            await tripService.deleteImage(id, imageUrl);
          } catch (err) {
            console.error('Failed to delete image:', err);
          }
        }
      }
      
      // Handle new image uploads
      if (imageData?.newImages && imageData.newImages.length > 0) {
        try {
          await tripService.uploadImages(id, imageData.newImages);
        } catch (err) {
          console.error('Failed to upload images:', err);
        }
      }
      
      if (packages && packages.length > 0) {
        // Packaged trip: update/create packages
        // Deactivate any previously-existing packages that were removed from the form
        const existingPackages = trip?.packages ?? [];
        for (let ei = packages.length; ei < existingPackages.length; ei++) {
          try {
            await tripService.deletePackage(id, existingPackages[ei].id.toString());
          } catch (err) {
            console.error('Failed to deactivate removed package:', err);
          }
        }

        for (let i = 0; i < packages.length; i++) {
          const packageData = packages[i];
          const existingPackage = existingPackages[i];
          let packageId: string;
          
          if (existingPackage) {
            await tripService.updatePackage(id, existingPackage.id.toString(), packageData);
            packageId = existingPackage.id.toString();
          } else {
            const createdPackage = await tripService.createPackage(id, packageData);
            packageId = createdPackage.id.toString();
          }
          
          const selectedFields = packageFields?.[i] || [];
          const fields: PackageRequiredField[] = selectedFields.map(fieldName => ({
            field_type: fieldName,
            validation_config: validationConfigs?.[i]?.[fieldName] || {}
          }));
          const hasValidationConfigs = fields.some(field => 
            field.validation_config && Object.keys(field.validation_config).length > 0
          );
          if (hasValidationConfigs) {
            await tripService.setPackageRequiredFieldsWithValidation(id, packageId, fields);
          } else {
            await tripService.setPackageRequiredFields(id, packageId, fields);
          }
        }
      } else if (packages === null) {
        // Non-packaged trip: backend synced the hidden package; update its required fields
        const tripPackages = await tripService.getPackages(id);
        if (tripPackages.length > 0) {
          const hiddenPkgId = tripPackages[0].id;
          const selectedFields = packageFields?.[0] || [];
          if (selectedFields.length > 0) {
            const fields: PackageRequiredField[] = selectedFields.map(fieldName => ({
              field_type: fieldName,
              validation_config: validationConfigs?.[0]?.[fieldName] || {}
            }));
            const hasValidationConfigs = fields.some(field => 
              field.validation_config && Object.keys(field.validation_config).length > 0
            );
            if (hasValidationConfigs) {
              await tripService.setPackageRequiredFieldsWithValidation(id, hiddenPkgId, fields);
            } else {
              await tripService.setPackageRequiredFields(id, hiddenPkgId, fields);
            }
          }
        }
      }
      
      router.push(`/trips/${id}`);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Edit Trip</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => router.push(`/trips/${id}`)} style={{ padding: '0.5rem 1rem' }}>
            View Details
          </button>
          <button onClick={handleDelete} disabled={isSubmitting} style={{ backgroundColor: 'red', color: 'white', padding: '0.5rem 1rem' }}>
            Delete Trip
          </button>
        </div>
      </div>
      <TripForm trip={trip} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
};

export default TripEditPage;
