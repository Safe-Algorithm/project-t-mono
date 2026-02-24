import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { Trip, CreateTripPackage, FieldMetadata, ValidationConfig, TripAmenity } from '../../types/trip';
import { TripCreatePayload, TripUpdatePayload, tripService } from '../../services/tripService';
import ValidationConfigComponent from './ValidationConfig';
import DestinationSelector, { DestinationSelection } from './DestinationSelector';
import { destinationService, Destination } from '../../services/destinationService';
import { useTranslation } from 'react-i18next';

interface TripFormProps {
  trip?: Trip;
  onSubmit: (
    payload: TripCreatePayload | TripUpdatePayload, 
    packages?: CreateTripPackage[] | null, 
    packageFields?: { [index: number]: string[] }, 
    validationConfigs?: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } },
    imageData?: { newImages: File[], imagesToDelete: string[] },
    destinationSelections?: DestinationSelection[]
  ) => void;
  isSubmitting: boolean;
}

const TripForm: React.FC<TripFormProps> = ({ trip, onSubmit, isSubmitting }) => {
  const { t } = useTranslation();
  const [isPackagedTrip, setIsPackagedTrip] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name_en: '',
    name_ar: '',
    description_en: '',
    description_ar: '',
    start_date: '',
    end_date: '',
    registration_deadline: '',
    max_participants: '',
    is_active: true,
    is_refundable: true,
    has_meeting_place: false,
    meeting_location: '',
    meeting_time: '',
  });

  // Non-packaged trip: trip-level price and required fields (stored on hidden package)
  const [tripPrice, setTripPrice] = useState<number>(0);
  const [tripRequiredFields, setTripRequiredFields] = useState<string[]>(['name', 'date_of_birth']);
  const [tripValidationConfigs, setTripValidationConfigs] = useState<{ [fieldName: string]: ValidationConfig }>({});
  const [showTripFieldValidation, setShowTripFieldValidation] = useState<{ [fieldName: string]: boolean }>({});

  const [startingCityId, setStartingCityId] = useState<string>('');
  const [countries, setCountries] = useState<Destination[]>([]);
  const [cities, setCities] = useState<Destination[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const [tripImages, setTripImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  const [packages, setPackages] = useState<CreateTripPackage[]>([
    { name_en: '', name_ar: '', description_en: '', description_ar: '', price: 0, currency: 'SAR' }
  ]);

  const [packageRequiredFields, setPackageRequiredFields] = useState<{ [index: number]: string[] }>({
    0: ['name', 'date_of_birth'] // Always include mandatory fields
  });

  const [packageValidationConfigs, setPackageValidationConfigs] = useState<{ [packageIndex: number]: { [fieldName: string]: ValidationConfig } }>({
    0: {} // Initialize with empty validation configs for first package
  });

  const [availableFields, setAvailableFields] = useState<FieldMetadata[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showValidationConfig, setShowValidationConfig] = useState<{ [packageIndex: number]: { [fieldName: string]: boolean } }>({});

  // Destination selections (form-state mode for new trips)
  const [destinationSelections, setDestinationSelections] = useState<DestinationSelection[]>([]);

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const all = await destinationService.getActiveDestinations();
        setCountries(all.filter(d => d.type === 'country'));
      } catch (err) {
        console.error('Failed to load countries:', err);
      }
    };
    loadCountries();
  }, []);

  useEffect(() => {
    if (!selectedCountryId) { setCities([]); return; }
    const country = countries.find(c => c.id === selectedCountryId);
    setCities(country?.children?.filter(c => c.type === 'city') ?? []);
  }, [selectedCountryId, countries]);

  useEffect(() => {
    // Load available fields on component mount
    const loadAvailableFields = async () => {
      try {
        const response = await tripService.getAvailableFields();
        setAvailableFields(response.fields || []);
      } catch (err) {
        console.error('Failed to load available fields:', err);
        setAvailableFields([]); // Ensure it's always an array
      }
    };
    
    loadAvailableFields();
    
    // Ensure mandatory fields are always selected for existing packages
    const ensureMandatoryFields = () => {
      setPackageRequiredFields(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          const mandatoryFields = ['name', 'date_of_birth'];
          const currentFields = updated[parseInt(key)] || [];
          const allFields = Array.from(new Set([...mandatoryFields, ...currentFields]));
          updated[parseInt(key)] = allFields;
        });
        return updated;
      });
    };
    
    ensureMandatoryFields();

    if (trip) {
      setIsPackagedTrip(trip.is_packaged_trip ?? false);
      // Populate trip form data
      setFormData({
        name_en: trip.name_en ?? '',
        name_ar: trip.name_ar ?? '',
        description_en: trip.description_en ?? '',
        description_ar: trip.description_ar ?? '',
        start_date: new Date(trip.start_date).toISOString().substring(0, 16),
        end_date: new Date(trip.end_date).toISOString().substring(0, 16),
        registration_deadline: trip.registration_deadline ? new Date(trip.registration_deadline).toISOString().substring(0, 16) : '',
        max_participants: trip.max_participants.toString(),
        is_active: trip.is_active,
        is_refundable: trip.is_refundable ?? true,
        has_meeting_place: trip.has_meeting_place ?? false,
        meeting_location: trip.meeting_location ?? '',
        meeting_time: trip.meeting_time ? new Date(trip.meeting_time).toISOString().substring(0, 16) : '',
      });
      if (trip.starting_city_id) {
        setStartingCityId(trip.starting_city_id);
      }

      // Populate amenities
      if (trip.amenities && trip.amenities.length > 0) {
        setSelectedAmenities(trip.amenities);
      }

      // Load existing images
      if (trip.images && trip.images.length > 0) {
        setTripImages(trip.images);
      }

      if (!trip.is_packaged_trip) {
        // Non-packaged: price and required fields come from the hidden package (not exposed in API)
        // We keep trip-level amenities/refundability in formData above
        // Price is not in TripRead for non-packaged trips; default 0 for new trips
        setTripPrice(0);
        setTripRequiredFields(['name', 'date_of_birth']);
      } else if (trip.packages && trip.packages.length > 0) {
        // Packaged: populate packages
        const existingPackages: CreateTripPackage[] = trip.packages.map(pkg => ({
          name_en: pkg.name_en,
          name_ar: pkg.name_ar,
          description_en: pkg.description_en,
          description_ar: pkg.description_ar,
          price: Number(pkg.price),
          currency: pkg.currency || 'SAR',
          max_participants: pkg.max_participants ?? null,
          is_refundable: pkg.is_refundable ?? null,
          amenities: pkg.amenities ?? null,
        }));
        setPackages(existingPackages);

        const existingPackageFields: { [index: number]: string[] } = {};
        const existingValidationConfigs: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } } = {};
        trip.packages.forEach((pkg, index) => {
          const fields = pkg.required_fields || [];
          const mandatoryFields = ['name', 'date_of_birth'];
          existingPackageFields[index] = Array.from(new Set([...mandatoryFields, ...fields]));
          const pkgValidationConfigs: { [fieldName: string]: ValidationConfig } = {};
          if (pkg.required_fields_details) {
            pkg.required_fields_details.forEach((fieldDetail: any) => {
              if (fieldDetail.validation_config && Object.keys(fieldDetail.validation_config).length > 0) {
                pkgValidationConfigs[fieldDetail.field_type] = fieldDetail.validation_config;
              }
            });
          }
          existingValidationConfigs[index] = pkgValidationConfigs;
        });
        setPackageRequiredFields(existingPackageFields);
        setPackageValidationConfigs(existingValidationConfigs);
      }
    }
  }, [trip]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    // For datetime inputs, ensure seconds are always set to 00
    if ((name === 'start_date' || name === 'end_date' || name === 'meeting_time' || name === 'registration_deadline') && value) {
      const dateValue = value + ':00';
      setFormData((prev) => ({ ...prev, [name]: dateValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) 
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const amenityLabels: Record<string, string> = {
    [TripAmenity.FLIGHT_TICKETS]: 'Flight Tickets',
    [TripAmenity.BUS]: 'Bus Transportation',
    [TripAmenity.TOUR_GUIDE]: 'Tour Guide',
    [TripAmenity.TOURS]: 'Tours',
    [TripAmenity.HOTEL]: 'Hotel Accommodation',
    [TripAmenity.MEALS]: 'Meals',
    [TripAmenity.INSURANCE]: 'Travel Insurance',
    [TripAmenity.VISA_ASSISTANCE]: 'Visa Assistance',
  };

  const addPackage = () => {
    const newIndex = packages.length;
    setPackages([...packages, { name_en: '', name_ar: '', description_en: '', description_ar: '', price: 0, currency: 'SAR' }]);
    // Always include mandatory fields for new packages
    setPackageRequiredFields(prev => ({ ...prev, [newIndex]: ['name', 'date_of_birth'] }));
    // Initialize empty validation configs for new package
    setPackageValidationConfigs(prev => ({ ...prev, [newIndex]: {} }));
  };

  const removePackage = (index: number) => {
    if (packages.length > 2) {
      setPackages(packages.filter((_, i) => i !== index));
      // Remove the fields for this package and reindex
      const newFields: { [index: number]: string[] } = {};
      const newValidationConfigs: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } } = {};
      
      Object.keys(packageRequiredFields).forEach(key => {
        const keyIndex = parseInt(key);
        if (keyIndex < index) {
          newFields[keyIndex] = packageRequiredFields[keyIndex];
          newValidationConfigs[keyIndex] = packageValidationConfigs[keyIndex] || {};
        } else if (keyIndex > index) {
          newFields[keyIndex - 1] = packageRequiredFields[keyIndex];
          newValidationConfigs[keyIndex - 1] = packageValidationConfigs[keyIndex] || {};
        }
      });
      setPackageRequiredFields(newFields);
      setPackageValidationConfigs(newValidationConfigs);
    }
  };

  const updatePackage = (index: number, field: keyof CreateTripPackage, value: string | number | boolean | string[] | null) => {
    const updatedPackages = [...packages];
    updatedPackages[index] = { ...updatedPackages[index], [field]: value };
    setPackages(updatedPackages);
  };

  const updatePackageRequiredFields = (packageIndex: number, selectedFields: string[]) => {
    setPackageRequiredFields(prev => ({
      ...prev,
      [packageIndex]: selectedFields
    }));
  };

  const toggleRequiredField = (packageIndex: number, fieldName: string) => {
    // Don't allow removal of mandatory fields
    const mandatoryFields = ['name', 'date_of_birth'];
    if (mandatoryFields.includes(fieldName)) {
      return; // Do nothing for mandatory fields
    }
    
    const currentFields = packageRequiredFields[packageIndex] || [];
    const updatedFields = currentFields.includes(fieldName)
      ? currentFields.filter(f => f !== fieldName)
      : [...currentFields, fieldName];
    
    updatePackageRequiredFields(packageIndex, updatedFields);
    
    // If removing a field, also remove its validation config
    if (currentFields.includes(fieldName) && !updatedFields.includes(fieldName)) {
      const newValidationConfigs = { ...packageValidationConfigs };
      if (newValidationConfigs[packageIndex]) {
        delete newValidationConfigs[packageIndex][fieldName];
      }
      setPackageValidationConfigs(newValidationConfigs);
    }
  };

  const updateFieldValidationConfig = (packageIndex: number, fieldName: string, config: ValidationConfig) => {
    setPackageValidationConfigs(prev => ({
      ...prev,
      [packageIndex]: {
        ...prev[packageIndex],
        [fieldName]: config
      }
    }));
  };

  const toggleValidationConfigVisibility = (packageIndex: number, fieldName: string) => {
    setShowValidationConfig(prev => ({
      ...prev,
      [packageIndex]: {
        ...prev[packageIndex],
        [fieldName]: !prev[packageIndex]?.[fieldName]
      }
    }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setNewImageFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imageUrl: string) => {
    setTripImages(prev => prev.filter(url => url !== imageUrl));
    setImagesToDelete(prev => [...prev, imageUrl]);
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (isPackagedTrip) {
      // Packaged: require at least 2 packages
      if (packages.length < 2) {
        newErrors.push('Packaged trips require at least 2 packages');
      }
      packages.forEach((pkg, index) => {
        if (!pkg.name_en.trim() && !pkg.name_ar.trim()) {
          newErrors.push(`Package ${index + 1}: Name in at least one language (EN or AR) is required`);
        }
        if (!pkg.description_en.trim() && !pkg.description_ar.trim()) {
          newErrors.push(`Package ${index + 1}: Description in at least one language (EN or AR) is required`);
        }
        if (pkg.price <= 0) {
          newErrors.push(`Package ${index + 1}: Price must be greater than 0`);
        }
      });
    } else {
      // Non-packaged: validate trip-level price
      if (tripPrice <= 0) {
        newErrors.push('Price must be greater than 0');
      }
    }

    setErrors(newErrors);
    if (newErrors.length > 0) {
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
    return newErrors.length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const payload = {
        ...formData,
        is_packaged_trip: isPackagedTrip,
        max_participants: parseInt(formData.max_participants, 10),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        registration_deadline: formData.registration_deadline
          ? new Date(formData.registration_deadline).toISOString()
          : undefined,
        starting_city_id: startingCityId || undefined,
        amenities: !isPackagedTrip && selectedAmenities.length > 0 ? selectedAmenities : undefined,
        meeting_time: formData.has_meeting_place && formData.meeting_time 
          ? new Date(formData.meeting_time).toISOString() 
          : undefined,
    };
    
    const imageData = {
      newImages: newImageFiles,
      imagesToDelete: imagesToDelete
    };

    if (isPackagedTrip) {
      onSubmit(payload, packages, packageRequiredFields, packageValidationConfigs, imageData, destinationSelections);
    } else {
      // Non-packaged: include price/is_refundable/amenities in the trip payload
      // Backend auto-creates/syncs the hidden package from these fields
      const nonPackagedPayload = {
        ...payload,
        price: tripPrice,
        is_refundable: formData.is_refundable,
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
      };
      // Pass required fields as index 0 so new.tsx/edit.tsx can update the hidden package's fields
      const hiddenFields = { 0: tripRequiredFields };
      const hiddenValidations = { 0: tripValidationConfigs };
      onSubmit(nonPackagedPayload, null, hiddenFields, hiddenValidations, imageData, destinationSelections);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition placeholder-slate-400 dark:placeholder-slate-500';
  const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';
  const sectionCls = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5';
  const sectionTitleCls = 'text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-3xl">

      {/* ── Error banner (auto-scrolled into view) ── */}
      {errors.length > 0 && (
        <div ref={errorRef} className="flex flex-col gap-1 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 dark:text-red-400">{t('form.fixFollowing')}</p>
          <ul className="list-disc list-inside">
            {errors.map((error, i) => (
              <li key={i} className="text-sm text-red-600 dark:text-red-300">{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Basic Info ── */}
      <div className={sectionCls}>
        <p className={sectionTitleCls}>{t('trip.details')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('trip.provideOneLanguage')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('trip.nameEn')} <span className="font-normal text-slate-400">({t('trip.optionalIfArabic')})</span></label>
            <input className={inputCls} name="name_en" value={formData.name_en} onChange={handleChange} placeholder={t('trip.nameEn')} />
          </div>
          <div>
            <label className={labelCls}>{t('trip.nameAr')} <span className="font-normal text-slate-400">({t('trip.optionalIfEnglish')})</span></label>
            <input className={inputCls} name="name_ar" value={formData.name_ar} onChange={handleChange} placeholder={t('trip.nameAr')} dir="rtl" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t('trip.descriptionEn')} <span className="font-normal text-slate-400">({t('trip.optionalIfArabic')})</span></label>
            <textarea className={inputCls} rows={3} name="description_en" value={formData.description_en} onChange={handleChange} placeholder={t('trip.descriptionEn')} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t('trip.descriptionAr')} <span className="font-normal text-slate-400">({t('trip.optionalIfEnglish')})</span></label>
            <textarea className={inputCls} rows={3} name="description_ar" value={formData.description_ar} onChange={handleChange} placeholder={t('trip.descriptionAr')} dir="rtl" />
          </div>
        </div>
      </div>

      {/* ── Dates ── */}
      <div className={sectionCls}>
        <p className={sectionTitleCls}>{t('trip.datesCapacity')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('trip.startDateTime')}</label>
            <input className={inputCls} type="datetime-local" name="start_date" value={formData.start_date} onChange={handleChange} required />
          </div>
          <div>
            <label className={labelCls}>{t('trip.endDateTime')}</label>
            <input className={inputCls} type="datetime-local" name="end_date" value={formData.end_date} onChange={handleChange} required />
          </div>
          <div>
            <label className={labelCls}>{t('trip.registrationDeadline')} <span className="font-normal text-slate-400">({t('trip.registrationDeadlineHint')})</span></label>
            <input className={inputCls} type="datetime-local" name="registration_deadline" value={formData.registration_deadline} onChange={handleChange} />
          </div>
          <div>
            <label className={labelCls}>{t('trip.maxParticipants')}</label>
            <input className={inputCls} type="number" name="max_participants" value={formData.max_participants} onChange={handleChange} placeholder={t('trip.maxParticipantsPlaceholder')} min="1" required />
          </div>
        </div>
      </div>

      {/* ── Starting City ── */}
      <div className={sectionCls}>
        <p className={sectionTitleCls}>{t('trip.startingCity')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('trip.startingCityHint')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('trip.country')}</label>
            <select className={inputCls} value={selectedCountryId} onChange={e => { setSelectedCountryId(e.target.value); setStartingCityId(''); }}>
              <option value="">{t('trip.selectCountry')}</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('trip.city')}</label>
            <select className={inputCls} value={startingCityId} onChange={e => setStartingCityId(e.target.value)} disabled={!selectedCountryId}>
              <option value="">{t('trip.selectCity')}</option>
              {cities.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </div>
        </div>
        {startingCityId && <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ {t('trip.startingCitySelected')}</p>}
      </div>
      {/* ── Status + Destinations ── */}
      <div className={sectionCls}>
        <p className={sectionTitleCls}>{t('trip.settingsDestinations')}</p>
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-4 h-4 accent-sky-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('status.active')}</span>
        </label>
        {trip ? (
          <DestinationSelector tripId={trip.id} />
        ) : (
          <DestinationSelector selections={destinationSelections} onSelectionsChange={setDestinationSelections} />
        )}
      </div>

      {/* ── Trip Type Toggle ── */}
      <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl border-2 border-sky-200 dark:border-sky-700 p-5">
        <p className="text-base font-bold text-sky-800 dark:text-sky-300 mb-1">{t('trip.tripType')}</p>
        <p className="text-xs text-sky-600 dark:text-sky-400 mb-4">{t('trip.tripTypeHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${!isPackagedTrip ? 'border-sky-500 bg-sky-100 dark:bg-sky-900/40' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
            <input type="radio" name="trip_type" checked={!isPackagedTrip} onChange={() => setIsPackagedTrip(false)} className="accent-sky-500" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{t('trip.simpleTrip')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('trip.simpleTripDesc')}</div>
            </div>
          </label>
          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${isPackagedTrip ? 'border-sky-500 bg-sky-100 dark:bg-sky-900/40' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
            <input type="radio" name="trip_type" checked={isPackagedTrip} onChange={() => setIsPackagedTrip(true)} className="accent-sky-500" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{t('trip.packagedTrip')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('trip.packagedTripDesc')}</div>
            </div>
          </label>
        </div>
      </div>

      {/* ── Non-packaged: trip-level price, refundability, amenities, required fields ── */}
      {!isPackagedTrip && (
        <div className={sectionCls}>
          <p className={sectionTitleCls}>{t('trip.pricePolicyFields')}</p>
          <div className="mb-4">
            <label className={labelCls}>{t('trip.pricePerPerson')}</label>
            <input className={inputCls} type="number" value={tripPrice} onChange={e => setTripPrice(parseFloat(e.target.value) || 0)} placeholder={t('trip.pricePlaceholder')} min="0.01" step="0.01" />
          </div>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" name="is_refundable" checked={formData.is_refundable} onChange={handleChange} className="w-4 h-4 accent-sky-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('trip.refundable')}</span>
          </label>
          <div className="mb-4">
            <p className={labelCls}>{t('trip.amenities')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(amenityLabels).map(([value, label]) => (
                <label key={value} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm font-medium transition ${selectedAmenities.includes(value) ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                  <input type="checkbox" checked={selectedAmenities.includes(value)} onChange={() => toggleAmenity(value)} className="accent-sky-500 flex-shrink-0" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className={labelCls}>{t('trip.requiredParticipantFields')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('trip.requiredFieldsNote')}</p>
            <div className="flex flex-col gap-2">
              {availableFields.map(field => {
                const mandatory = ['name', 'date_of_birth'].includes(field.field_name);
                const isChecked = tripRequiredFields.includes(field.field_name) || mandatory;
                const hasValidations = field.available_validations && field.available_validations.length > 0;
                const showConfig = showTripFieldValidation[field.field_name] || false;
                return (
                  <div key={field.field_name} className={`rounded-xl border p-3 transition-colors ${isChecked ? 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <label className={`flex items-center gap-2 text-sm flex-1 min-w-0 ${mandatory ? 'opacity-60' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={isChecked} disabled={mandatory} onChange={() => { if (mandatory) return; setTripRequiredFields(prev => prev.includes(field.field_name) ? prev.filter(f => f !== field.field_name) : [...prev, field.field_name]); }} className="accent-sky-500 flex-shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{field.display_name}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs">({field.ui_type})</span>
                        {mandatory && <span className="text-red-400 dark:text-red-500 text-xs font-bold">({t('common.required')})</span>}
                      </label>
                      {isChecked && hasValidations && (
                        <button type="button" onClick={() => setShowTripFieldValidation(prev => ({ ...prev, [field.field_name]: !prev[field.field_name] }))} className={`text-xs px-2.5 py-1 rounded-lg border transition flex-shrink-0 ${showConfig ? 'bg-sky-500 text-white border-sky-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-sky-400'}`}>
                          {showConfig ? t('form.hide') : t('form.configure')} {t('form.validations')}
                        </button>
                      )}
                    </div>
                    {isChecked && hasValidations && showConfig && (
                      <ValidationConfigComponent fieldMetadata={field} currentConfig={tripValidationConfigs[field.field_name] || {}} onConfigChange={config => setTripValidationConfigs(prev => ({ ...prev, [field.field_name]: config }))} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Meeting Place ── */}
      <div className={sectionCls}>
        <p className={sectionTitleCls}>{t('trip.meetingPlace')}</p>
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" name="has_meeting_place" checked={formData.has_meeting_place} onChange={handleChange} className="w-4 h-4 accent-sky-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('trip.meetingPlaceDescription')}</span>
        </label>
        {formData.has_meeting_place && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-6">
            <div>
              <label className={labelCls}>{t('trip.meetingLocation')}</label>
              <input className={inputCls} type="text" name="meeting_location" value={formData.meeting_location} onChange={handleChange} placeholder={t('trip.meetingLocationPlaceholder')} />
            </div>
            <div>
              <label className={labelCls}>{t('trip.meetingTime')}</label>
              <input className={inputCls} type="datetime-local" name="meeting_time" value={formData.meeting_time} onChange={handleChange} />
            </div>
          </div>
        )}
      </div>

      {/* ── Images ── */}
      <div className={sectionCls}>
        <p className={sectionTitleCls}>{t('trip.images')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('trip.imagesDescription')} <span className="font-semibold">JPG, PNG, WEBP</span></p>
        {tripImages.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">{t('trip.currentImages')}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {tripImages.map((imageUrl, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={imageUrl} alt={`Trip ${index + 1}`} className="w-full h-28 object-cover" />
                  <button type="button" onClick={() => removeExistingImage(imageUrl)} className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-0.5 rounded">{t('form.remove')}</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {newImageFiles.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">{t('trip.newImages')}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {newImageFiles.map((file, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden border border-sky-300 dark:border-sky-700">
                  <img src={URL.createObjectURL(file)} alt={`New ${index + 1}`} className="w-full h-28 object-cover" />
                  <button type="button" onClick={() => removeNewImage(index)} className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-0.5 rounded">{t('form.remove')}</button>
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded truncate max-w-[90%]">{file.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={handleImageFileChange} className="hidden" id="trip-image-upload" />
        <label htmlFor="trip-image-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg cursor-pointer transition">
          + {t('form.addImages')}
        </label>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Supported: JPG · PNG · WEBP</p>
      </div>

      {/* ── Packaged: multi-package section ── */}
      {isPackagedTrip && (
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-1">
            <p className={sectionTitleCls + ' mb-0'}>{t('package.packageNumber', { number: '' }).replace(' ', '')} <span className="text-sm font-normal text-slate-400">({t('package.minRequired')})</span></p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('package.provideOneLanguage')}</p>
          <div className="flex flex-col gap-4">
            {packages.map((pkg, index) => (
              <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('package.packageNumber', { number: index + 1 })}</p>
                  {packages.length > 2 ? (
                    <button type="button" onClick={() => removePackage(index)} className="text-xs text-red-600 hover:text-red-700 font-semibold">{t('form.removePackage')}</button>
                  ) : (
                    <span className="text-xs text-slate-400">(min 2 {t('common.required')})</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>{t('package.nameEn')} <span className="font-normal text-slate-400">({t('common.optional')})</span></label>
                    <input className={inputCls} value={pkg.name_en} onChange={(e) => updatePackage(index, 'name_en', e.target.value)} placeholder={t('package.nameEn')} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('package.nameAr')} <span className="font-normal text-slate-400">({t('common.optional')})</span></label>
                    <input className={inputCls} value={pkg.name_ar} onChange={(e) => updatePackage(index, 'name_ar', e.target.value)} placeholder={t('package.nameAr')} dir="rtl" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('package.descriptionEn')} <span className="font-normal text-slate-400">({t('common.optional')})</span></label>
                    <textarea className={inputCls} rows={2} value={pkg.description_en} onChange={(e) => updatePackage(index, 'description_en', e.target.value)} placeholder={t('package.descriptionEn')} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('package.descriptionAr')} <span className="font-normal text-slate-400">({t('common.optional')})</span></label>
                    <textarea className={inputCls} rows={2} value={pkg.description_ar} onChange={(e) => updatePackage(index, 'description_ar', e.target.value)} placeholder={t('package.descriptionAr')} dir="rtl" />
                  </div>
                  <div>
                    <label className={labelCls}>{t('package.price')} (SAR)</label>
                    <input className={inputCls} type="number" value={pkg.price} onChange={(e) => updatePackage(index, 'price', parseFloat(e.target.value) || 0)} placeholder={t('package.pricePlaceholder')} min="0.01" step="0.01" required />
                  </div>
                  <div>
                    <label className={labelCls}>{t('package.maxParticipants')}</label>
                    <input className={inputCls} type="number" value={pkg.max_participants ?? ''} onChange={(e) => updatePackage(index, 'max_participants', parseInt(e.target.value) || 0)} placeholder={t('package.maxParticipantsPlaceholder')} min="1" />
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input type="checkbox" checked={pkg.is_refundable ?? false} onChange={(e) => updatePackage(index, 'is_refundable', e.target.checked)} className="w-4 h-4 accent-sky-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('trip.refundable')}</span>
                </label>
                <div className="mb-3">
                  <p className={labelCls}>{t('trip.amenities')}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(amenityLabels).map(([value, label]) => {
                      const pkgAmenities = pkg.amenities ?? [];
                      return (
                        <label key={value} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-medium transition ${pkgAmenities.includes(value) ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                          <input type="checkbox" checked={pkgAmenities.includes(value)} onChange={() => { const updated = pkgAmenities.includes(value) ? pkgAmenities.filter(a => a !== value) : [...pkgAmenities, value]; updatePackage(index, 'amenities', updated as any); }} className="accent-sky-500 flex-shrink-0" />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className={labelCls}>{t('package.requiredFields')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('package.nameDOBAlwaysRequired')}</p>
                  <div className="flex flex-col gap-2">
                    {availableFields.map((field) => {
                      const isMandatory = ['name', 'date_of_birth'].includes(field.field_name);
                      const isChecked = (packageRequiredFields[index] || []).includes(field.field_name) || isMandatory;
                      const hasValidations = field.available_validations && field.available_validations.length > 0;
                      const showConfig = showValidationConfig[index]?.[field.field_name] || false;
                      return (
                        <div key={field.field_name} className={`rounded-xl border p-3 transition-colors ${isChecked ? 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <label className={`flex items-center gap-2 text-sm flex-1 min-w-0 ${isMandatory ? 'opacity-60' : 'cursor-pointer'}`}>
                              <input type="checkbox" checked={isChecked} disabled={isMandatory} onChange={() => toggleRequiredField(index, field.field_name)} className="accent-sky-500 flex-shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{field.display_name}</span>
                              <span className="text-slate-400 dark:text-slate-500 text-xs">({field.ui_type})</span>
                              {isMandatory && <span className="text-red-400 dark:text-red-500 text-xs font-bold">({t('common.required')})</span>}
                            </label>
                            {isChecked && hasValidations && (
                              <button type="button" onClick={() => toggleValidationConfigVisibility(index, field.field_name)} className={`text-xs px-2.5 py-1 rounded-lg border transition flex-shrink-0 ${showConfig ? 'bg-sky-500 text-white border-sky-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-sky-400'}`}>
                                {showConfig ? t('form.hide') : t('form.configure')} {t('form.validations')}
                              </button>
                            )}
                          </div>
                          {isChecked && hasValidations && showConfig && (
                            <ValidationConfigComponent fieldMetadata={field} currentConfig={packageValidationConfigs[index]?.[field.field_name] || {}} onConfigChange={(config) => updateFieldValidationConfig(index, field.field_name, config)} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addPackage} className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition">
            + {t('form.addPackage')}
          </button>
        </div>
      )}

      {/* ── Submit ── */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md transition"
        >
          {isSubmitting && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          {isSubmitting ? t('form.submitting') : (trip ? t('form.updateTrip') : t('form.createTrip'))}
        </button>
        {isSubmitting && (
          <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">{t('form.uploadingImages')}</p>
        )}
      </div>
    </form>
  );
};

export default TripForm;
