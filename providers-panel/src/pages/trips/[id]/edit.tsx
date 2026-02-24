import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import TripForm from '../../../components/trips/TripForm';
import { tripService, TripUpdatePayload } from '../../../services/tripService';
import { Trip, CreateTripPackage, PackageRequiredField, ValidationConfig } from '../../../types/trip';

const TripEditPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
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
            setError(t('trip.loadingError'));
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
        setError(t('trip.loadingError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id || typeof id !== 'string') return;
    if (window.confirm(t('trip.deleteTrip') + '?')) {
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

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
    </div>
  );

  if (error && !trip) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
      <button onClick={() => router.back()} className="text-sm text-sky-600 dark:text-sky-400 hover:underline">{t('trip.goBack')}</button>
    </div>
  );

  if (!trip) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400 dark:text-slate-500 text-sm">{t('trip.notFound')}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('trip.editTrip')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">{trip.name_en || trip.name_ar}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => router.push(`/trips/${id}`)}
            className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('trip.viewDetails')}
          </button>
          <button
            onClick={handleDelete}
            disabled={isSubmitting}
            className="px-3 py-2 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('trip.deleteTrip')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <TripForm trip={trip} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
};

export default TripEditPage;
