import React, { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import TripForm from '../../components/trips/TripForm';
import { tripService, TripCreatePayload, TripUpdatePayload } from '../../services/tripService';
import { extractErrorMessage } from '../../services/api';
import { destinationService } from '../../services/destinationService';
import { imageCollectionService } from '../../services/imageCollectionService';
import { DestinationSelection } from '../../components/trips/DestinationSelector';
import { CreateTripPackage, CreateTripExtraFee, PackageRequiredField, ValidationConfig } from '../../types/trip';
import { readAndParseCsvFile, CsvFieldError } from '../../services/tripCsvService';

const NewTripPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageWarnings, setImageWarnings] = useState<string[]>([]);
  const [csvErrors, setCsvErrors] = useState<CsvFieldError[]>([]);
  const [csvSuccess, setCsvSuccess] = useState(false);
  const [csvParsing, setCsvParsing] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCsvErrors([]);
    setCsvSuccess(false);
    setCsvParsing(true);
    try {
      const result = await readAndParseCsvFile(file);
      if ('errors' in result) {
        setCsvErrors(result.errors);
      } else {
        setCsvSuccess(true);
        setPendingImport(result.data);
        setTimeout(() => setCsvSuccess(false), 4000);
      }
    } catch {
      setCsvErrors([{ field: 'name_en', messageKey: 'csv.error.readFailed' }]);
    } finally {
      setCsvParsing(false);
    }
  };

  const [pendingImport, setPendingImport] = useState<import('../../services/tripCsvService').TripCsvImport | null>(null);

  const handleSubmit = async (
    payload: TripCreatePayload | TripUpdatePayload, 
    packages?: CreateTripPackage[] | null, 
    packageFields?: { [index: number]: string[] },
    validationConfigs?: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } },
    imageData?: { newImages: File[], imagesToDelete: string[], collectionUrls: string[] },
    destinationSelections?: DestinationSelection[],
    extraFees?: CreateTripExtraFee[]
  ) => {
    setIsSubmitting(true);
    setError(null);
    setImageWarnings([]);
    try {
      // Create the trip first
      const createdTrip = await tripService.create(payload as TripCreatePayload);
      
      // Upload new image files if any
      if (imageData?.newImages && imageData.newImages.length > 0) {
        try {
          const uploadResult = await tripService.uploadImages(createdTrip.id, imageData.newImages);
          if (uploadResult.failed && uploadResult.failed.length > 0) {
            setImageWarnings(uploadResult.failed.map(f => `"${f.filename}": ${f.reason}`));
          }
        } catch (err) {
          setImageWarnings([err instanceof Error ? err.message : 'Some images failed to upload.']);
        }
      }

      // Attach images selected from provider collection
      if (imageData?.collectionUrls && imageData.collectionUrls.length > 0) {
        for (const url of imageData.collectionUrls) {
          try {
            // Find the image id by matching url from the collection service response
            const collectionRes = await imageCollectionService.getAll(0, 200);
            const match = collectionRes.items.find(img => img.url === url);
            if (match) {
              await imageCollectionService.attachToTrip(createdTrip.id, match.id);
            }
          } catch (err) {
            console.error('Failed to attach collection image:', err);
          }
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
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to create trip'));
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hidden file input for CSV import */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <button
            type="button"
            disabled={csvParsing}
            onClick={() => { setCsvErrors([]); setCsvSuccess(false); csvInputRef.current?.click(); }}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-sm font-semibold text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {csvParsing ? (
              <span className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            {csvParsing ? t('csv.importing') : t('csv.importFromCsv')}
          </button>
          <button
            onClick={() => router.push('/trips')}
            className="self-start sm:self-auto px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('trip.cancelCreate')}
          </button>
        </div>
      </div>

      {/* CSV import success banner */}
      {csvSuccess && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {t('csv.importSuccess')}
        </div>
      )}

      {/* CSV import error banner */}
      {csvErrors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-red-700 dark:text-red-400">{t('csv.importErrors')}</p>
            <button
              type="button"
              onClick={() => setCsvErrors([])}
              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 underline"
            >
              {t('common.dismiss')}
            </button>
          </div>
          <ul className="list-disc list-inside space-y-1">
            {csvErrors.map((err, i) => (
              <li key={i} className="text-sm text-red-600 dark:text-red-300">
                {String(t(err.messageKey, err.params ?? {}))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {imageWarnings.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{t('trips.imageUploadFailTitle')}</p>
            <button type="button" onClick={() => setImageWarnings([])} className="text-xs text-amber-600 hover:text-amber-800 dark:hover:text-amber-300 underline">{t('trips.imageUploadDismiss')}</button>
          </div>
          <ul className="list-disc list-inside space-y-1">
            {imageWarnings.map((w, i) => <li key={i} className="text-sm text-amber-700 dark:text-amber-300">{w}</li>)}
          </ul>
        </div>
      )}

      <TripForm onSubmit={handleSubmit} isSubmitting={isSubmitting} pendingImport={pendingImport} />
    </div>
  );
};

export default NewTripPage;
