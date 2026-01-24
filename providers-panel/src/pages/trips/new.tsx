import React, { useState } from 'react';
import { useRouter } from 'next/router';
import TripForm from '../../components/trips/TripForm';
import { tripService, TripCreatePayload, TripUpdatePayload } from '../../services/tripService';
import { CreateTripPackage, PackageRequiredField, ValidationConfig } from '../../types/trip';

const NewTripPage = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (
    payload: TripCreatePayload | TripUpdatePayload, 
    packages?: CreateTripPackage[], 
    packageFields?: { [index: number]: string[] },
    validationConfigs?: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } },
    imageData?: { newImages: File[], imagesToDelete: string[] }
  ) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Create the trip first
      const createdTrip = await tripService.create(payload as TripCreatePayload);
      
      // Upload images if any
      if (imageData?.newImages && imageData.newImages.length > 0) {
        try {
          await tripService.uploadImages(createdTrip.id, imageData.newImages);
        } catch (err) {
          console.error('Failed to upload images:', err);
        }
      }
      
      // Create packages and their required fields
      if (packages && packages.length > 0) {
        for (let i = 0; i < packages.length; i++) {
          const packageData = packages[i];
          const createdPackage = await tripService.createPackage(createdTrip.id, packageData);
          
          // Set required fields for this package if any are selected
          const selectedFields = packageFields?.[i] || [];
          if (selectedFields.length > 0) {
            const fields: PackageRequiredField[] = selectedFields.map(fieldName => ({
              field_type: fieldName,
              validation_config: validationConfigs?.[i]?.[fieldName] || {}
            }));
            
            // Use the new validation-aware endpoint if validation configs are present
            const hasValidationConfigs = fields.some(field => 
              field.validation_config && Object.keys(field.validation_config).length > 0
            );
            
            if (hasValidationConfigs) {
              await tripService.setPackageRequiredFieldsWithValidation(createdTrip.id, createdPackage.id, fields);
            } else {
              await tripService.setPackageRequiredFields(createdTrip.id, createdPackage.id, fields);
            }
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
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create New Trip</h1>
          <p className="mt-2 text-sm text-gray-600">Fill in the details to create a new trip offering</p>
        </div>
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          </div>
        )}
        
        <div className="bg-white shadow-lg rounded-lg p-8">
          <TripForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </div>
  );
};

export default NewTripPage;
