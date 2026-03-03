import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import TripForm from '../../components/trips/TripForm';
import { tripService, TripCreatePayload, TripUpdatePayload } from '../../services/tripService';
import { destinationService } from '../../services/destinationService';
import { DestinationSelection } from '../../components/trips/DestinationSelector';
import { CreateTripPackage, CreateTripExtraFee, PackageRequiredField, ValidationConfig } from '../../types/trip';

const NewTripPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (
    payload: TripCreatePayload | TripUpdatePayload, 
    packages?: CreateTripPackage[] | null, 
    packageFields?: { [index: number]: string[] },
    validationConfigs?: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } },
    imageData?: { newImages: File[], imagesToDelete: string[] },
    destinationSelections?: DestinationSelection[],
    extraFees?: CreateTripExtraFee[]
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
      
      if (packages && packages.length > 0) {
        // Packaged trip: create each package and set required fields
        for (let i = 0; i < packages.length; i++) {
          const packageData = packages[i];
          const createdPackage = await tripService.createPackage(createdTrip.id, packageData);
          
          const selectedFields = packageFields?.[i] || [];
          if (selectedFields.length > 0) {
            const fields: PackageRequiredField[] = selectedFields.map(fieldName => ({
              field_type: fieldName,
              validation_config: validationConfigs?.[i]?.[fieldName] || {}
            }));
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
      } else if (packages === null) {
        // Non-packaged trip: backend auto-created the hidden package; update its required fields
        const tripPackages = await tripService.getPackages(createdTrip.id);
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
              await tripService.setPackageRequiredFieldsWithValidation(createdTrip.id, hiddenPkgId, fields);
            } else {
              await tripService.setPackageRequiredFields(createdTrip.id, hiddenPkgId, fields);
            }
          }
        }
      }
      
      // Add destinations
      if (destinationSelections && destinationSelections.length > 0) {
        for (const sel of destinationSelections) {
          try {
            await destinationService.addTripDestination(
              createdTrip.id,
              sel.destination_id,
              sel.place_id
            );
          } catch (err) {
            console.error('Failed to add destination:', err);
          }
        }
      }

      // Create extra fees
      if (extraFees && extraFees.length > 0) {
        for (const fee of extraFees) {
          if (!fee.name_en.trim() && !fee.name_ar.trim()) continue;
          try {
            await tripService.createExtraFee(createdTrip.id, fee);
          } catch (err) {
            console.error('Failed to create extra fee:', err);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('trip.createNew')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('trip.createNewSubtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/trips')}
          className="self-start sm:self-auto px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {t('trip.cancelCreate')}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <TripForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
};

export default NewTripPage;
