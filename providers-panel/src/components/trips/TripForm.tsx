import React, { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { TripCsvImport } from '../../services/tripCsvService';
import { Trip, CreateTripPackage, CreateTripExtraFee, FieldMetadata, ValidationConfig, TripAmenity, TripType, PricingTier } from '../../types/trip';
import { TripCreatePayload, TripUpdatePayload, tripService } from '../../services/tripService';
import ValidationConfigComponent from './ValidationConfig';
import DestinationSelector, { DestinationSelection } from './DestinationSelector';
import { destinationService, Destination } from '../../services/destinationService';
import { imageCollectionService, ProviderImage } from '../../services/imageCollectionService';
import { useTranslation } from 'react-i18next';

interface TripFormProps {
  trip?: Trip;
  pendingImport?: TripCsvImport | null;
  onImport?: (data: TripCsvImport) => void;
  onSubmit: (
    payload: TripCreatePayload | TripUpdatePayload, 
    packages?: CreateTripPackage[] | null, 
    packageFields?: { [index: number]: string[] }, 
    validationConfigs?: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } },
    imageData?: { newImages: File[], imagesToDelete: string[], collectionUrls: string[] },
    destinationSelections?: DestinationSelection[],
    extraFees?: CreateTripExtraFee[]
  ) => void;
  isSubmitting: boolean;
}

const TripForm: React.FC<TripFormProps> = ({ trip, onSubmit, isSubmitting, onImport, pendingImport }) => {
  const { t, i18n } = useTranslation();
  const [isPackagedTrip, setIsPackagedTrip] = useState(false);
  const [tripTypeSelection, setTripTypeSelection] = useState<TripType>(TripType.GUIDED);
  const [showGuidedTooltip, setShowGuidedTooltip] = useState(false);
  const [showPackageTooltip, setShowPackageTooltip] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Timezone is auto-derived from the starting city on the backend.
  // We keep it locally only so that datetime-local inputs show the correct wall-clock time
  // when editing an existing trip. Falls back to Asia/Riyadh if city has no timezone.
  const [timezone, setTimezone] = useState('Asia/Riyadh');

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
    meeting_place_name: '',
    meeting_place_name_ar: '',
    meeting_location: ''
  });

  // Non-packaged trip: trip-level price and required fields (stored on hidden package)
  const [tripPrice, setTripPrice] = useState<string>('');
  const [tripFlexiblePricing, setTripFlexiblePricing] = useState(false);
  const [tripPricingTiers, setTripPricingTiers] = useState<PricingTier[]>([{ from_participant: 1, price_per_person: 0 }]);
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
  const [selectedCollectionUrls, setSelectedCollectionUrls] = useState<string[]>([]);

  const [packages, setPackages] = useState<CreateTripPackage[]>([
    { name_en: '', name_ar: '', description_en: '', description_ar: '', price: 0, currency: 'SAR' }
  ]);

  const [packageRequiredFields, setPackageRequiredFields] = useState<{ [index: number]: string[] }>({
    0: ['name', 'date_of_birth'] // Always include mandatory fields
  });

  const [packageValidationConfigs, setPackageValidationConfigs] = useState<{ [packageIndex: number]: { [fieldName: string]: ValidationConfig } }>({
    0: {} // Initialize with empty validation configs for first package
  });

  const [packageFlexiblePricing, setPackageFlexiblePricing] = useState<{ [index: number]: boolean }>({ 0: false });
  const [packagePricingTiers, setPackagePricingTiers] = useState<{ [index: number]: PricingTier[] }>({
    0: [{ from_participant: 1, price_per_person: 0 }]
  });

  const [availableFields, setAvailableFields] = useState<FieldMetadata[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showValidationConfig, setShowValidationConfig] = useState<{ [packageIndex: number]: { [fieldName: string]: boolean } }>({});

  // Destination selections (form-state mode for new trips)
  const [destinationSelections, setDestinationSelections] = useState<DestinationSelection[]>([]);

  // Extra fees (draft rows)
  const [extraFees, setExtraFees] = useState<CreateTripExtraFee[]>([]);

  // Apply imported CSV data to form fields (new-trip mode only)
  const applyImport = useCallback((data: TripCsvImport) => {
    setFormData(prev => ({
      ...prev,
      name_en: data.name_en,
      name_ar: data.name_ar,
      description_en: data.description_en,
      description_ar: data.description_ar,
      start_date: data.start_date,
      end_date: data.end_date,
      registration_deadline: data.registration_deadline,
      max_participants: String(data.max_participants),
      is_refundable: data.is_refundable,
    }));
    setTripTypeSelection(data.trip_nature === 'self_arranged' ? TripType.SELF_ARRANGED : TripType.GUIDED);
    setIsPackagedTrip(data.tier_structure === 'multiple');
    if (data.tier_structure === 'single' && data.price_sar != null) {
      setTripPrice(String(data.price_sar));
    }
    if (data.amenities.length > 0) {
      setSelectedAmenities(data.amenities);
    }
    if (onImport) onImport(data);
  }, [onImport]);

  // React to pendingImport prop changes (set by new.tsx when a CSV file is parsed)
  useEffect(() => {
    if (!trip && pendingImport) {
      applyImport(pendingImport);
    }
  }, [pendingImport, applyImport, trip]);

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

  // Resolve the parent country for the starting city once countries are loaded.
  // This is a separate effect because countries load asynchronously and may not
  // be available when the trip effect first runs.
  useEffect(() => {
    if (!trip?.starting_city_id || !countries.length || selectedCountryId) return;
    for (const country of countries) {
      const found = country.children?.some(c => c.id === trip.starting_city_id);
      if (found) {
        setSelectedCountryId(country.id);
        break;
      }
    }
  }, [trip, countries]);

  useEffect(() => {
    // Load available fields on component mount
    const loadAvailableFields = async () => {
      try {
        const response = await tripService.getAvailableFields();
        setAvailableFields(response.fields || []);
      } catch (err) {
        console.error('Failed to load available fields:', err);
        setAvailableFields([]);
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
      setTripTypeSelection((trip.trip_type as TripType) ?? TripType.GUIDED);
      // Populate trip form data
      const rawTz = trip.timezone ?? 'Asia/Riyadh';
      const tz = (() => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: rawTz });
          return rawTz;
        } catch {
          return 'Asia/Riyadh';
        }
      })();
      setTimezone(tz);
      // Convert UTC datetimes from DB into local wall-clock time for the trip's timezone
      // so the provider sees the time they originally entered, not browser-local time.
      // (timezone is read-only here — it is always derived from the starting city on save)
      const toTzLocal = (utcStr: string) => {
        const d = new Date(utcStr + (utcStr.endsWith('Z') ? '' : 'Z'));
        // Format as YYYY-MM-DDTHH:mm in the trip's timezone
        return d.toLocaleString('sv-SE', { timeZone: tz }).substring(0, 16);
      };
      setFormData({
        name_en: trip.name_en ?? '',
        name_ar: trip.name_ar ?? '',
        description_en: trip.description_en ?? '',
        description_ar: trip.description_ar ?? '',
        start_date: toTzLocal(trip.start_date),
        end_date: toTzLocal(trip.end_date),
        registration_deadline: trip.registration_deadline ? toTzLocal(trip.registration_deadline) : '',
        max_participants: trip.max_participants.toString(),
        is_active: trip.is_active,
        is_refundable: trip.is_refundable ?? true,
        has_meeting_place: trip.has_meeting_place ?? false,
        meeting_place_name: trip.meeting_place_name ?? '',
        meeting_place_name_ar: trip.meeting_place_name_ar ?? '',
        meeting_location: trip.meeting_location ?? ''
      });
      if (trip.starting_city_id) {
        setStartingCityId(trip.starting_city_id);
        // Country resolution is deferred to a separate effect that depends on
        // both trip and countries, since countries may not be loaded yet here.
      }

      // Populate amenities
      if (trip.amenities && trip.amenities.length > 0) {
        setSelectedAmenities(trip.amenities);
      }

      // Load existing images
      if (trip.images && trip.images.length > 0) {
        setTripImages(trip.images);
      }

      // Populate extra fees (read-only snapshot for display; deletions handled on submit)
      if (trip.extra_fees && trip.extra_fees.length > 0) {
        setExtraFees(trip.extra_fees.map(f => ({
          name_en: f.name_en,
          name_ar: f.name_ar,
          description_en: f.description_en ?? '',
          description_ar: f.description_ar ?? '',
          amount: f.amount,
          currency: f.currency,
          is_mandatory: f.is_mandatory,
        })));
      }

      if (!trip.is_packaged_trip) {
        // Non-packaged: price comes from the hidden package and is exposed via trip.price
        setTripPrice(trip.price != null ? String(trip.price) : '');
        const useFlexible = (trip as any).simple_trip_use_flexible_pricing ?? false;
        setTripFlexiblePricing(useFlexible);
        const existingTiers = (trip as any).simple_trip_pricing_tiers ?? [];
        setTripPricingTiers(existingTiers.length > 0
          ? existingTiers.map((t: any) => ({ from_participant: t.from_participant, price_per_person: Number(t.price_per_person) }))
          : [{ from_participant: 1, price_per_person: 0 }]);
        const mandatoryFields = ['name', 'date_of_birth'];
        const hiddenFields = trip.simple_trip_required_fields || [];
        setTripRequiredFields(Array.from(new Set([...mandatoryFields, ...hiddenFields])));
        const hiddenValidationConfigs: { [fieldName: string]: ValidationConfig } = {};
        if (trip.simple_trip_required_fields_details) {
          trip.simple_trip_required_fields_details.forEach((fieldDetail) => {
            if (fieldDetail.validation_config && Object.keys(fieldDetail.validation_config).length > 0) {
              hiddenValidationConfigs[fieldDetail.field_type] = fieldDetail.validation_config;
            }
          });
        }
        setTripValidationConfigs(hiddenValidationConfigs);
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
        const existingFlexiblePricing: { [index: number]: boolean } = {};
        const existingPricingTiers: { [index: number]: PricingTier[] } = {};
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
          existingFlexiblePricing[index] = (pkg as any).use_flexible_pricing ?? false;
          const tiers = (pkg as any).pricing_tiers ?? [];
          existingPricingTiers[index] = tiers.length > 0
            ? tiers.map((t: any) => ({ from_participant: t.from_participant, price_per_person: Number(t.price_per_person) }))
            : [{ from_participant: 1, price_per_person: 0 }];
        });
        setPackageRequiredFields(existingPackageFields);
        setPackageValidationConfigs(existingValidationConfigs);
        setPackageFlexiblePricing(existingFlexiblePricing);
        setPackagePricingTiers(existingPricingTiers);
      }
    }
  }, [trip]);

  useEffect(() => {
    tripService.getAvailableFields()
      .then(r => setAvailableFields(r.fields || []))
      .catch(() => {});
  }, [i18n.language]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) 
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const amenityKeys = Object.values(TripAmenity) as string[];

  const addExtraFee = () => {
    setExtraFees(prev => [...prev, { name_en: '', name_ar: '', description_en: '', description_ar: '', amount: 0, currency: 'SAR', is_mandatory: true }]);
  };

  const removeExtraFee = (index: number) => {
    setExtraFees(prev => prev.filter((_, i) => i !== index));
  };

  const updateExtraFee = (index: number, field: keyof CreateTripExtraFee, value: string | number | boolean) => {
    setExtraFees(prev => prev.map((fee, i) => i === index ? { ...fee, [field]: value } : fee));
  };

  const addPackage = () => {
    const newIndex = packages.length;
    setPackages([...packages, { name_en: '', name_ar: '', description_en: '', description_ar: '', price: 0, currency: 'SAR' }]);
    setPackageRequiredFields(prev => ({ ...prev, [newIndex]: ['name', 'date_of_birth'] }));
    setPackageValidationConfigs(prev => ({ ...prev, [newIndex]: {} }));
    setPackageFlexiblePricing(prev => ({ ...prev, [newIndex]: false }));
    setPackagePricingTiers(prev => ({ ...prev, [newIndex]: [{ from_participant: 1, price_per_person: 0 }] }));
  };

  const removePackage = (index: number) => {
    if (packages.length > 2) {
      setPackages(packages.filter((_, i) => i !== index));
      const newFields: { [index: number]: string[] } = {};
      const newValidationConfigs: { [packageIndex: number]: { [fieldName: string]: ValidationConfig } } = {};
      const newFlexiblePricing: { [index: number]: boolean } = {};
      const newPricingTiers: { [index: number]: PricingTier[] } = {};
      Object.keys(packageRequiredFields).forEach(key => {
        const keyIndex = parseInt(key);
        if (keyIndex < index) {
          newFields[keyIndex] = packageRequiredFields[keyIndex];
          newValidationConfigs[keyIndex] = packageValidationConfigs[keyIndex] || {};
          newFlexiblePricing[keyIndex] = packageFlexiblePricing[keyIndex] ?? false;
          newPricingTiers[keyIndex] = packagePricingTiers[keyIndex] ?? [{ from_participant: 1, price_per_person: 0 }];
        } else if (keyIndex > index) {
          newFields[keyIndex - 1] = packageRequiredFields[keyIndex];
          newValidationConfigs[keyIndex - 1] = packageValidationConfigs[keyIndex] || {};
          newFlexiblePricing[keyIndex - 1] = packageFlexiblePricing[keyIndex] ?? false;
          newPricingTiers[keyIndex - 1] = packagePricingTiers[keyIndex] ?? [{ from_participant: 1, price_per_person: 0 }];
        }
      });
      setPackageRequiredFields(newFields);
      setPackageValidationConfigs(newValidationConfigs);
      setPackageFlexiblePricing(newFlexiblePricing);
      setPackagePricingTiers(newPricingTiers);
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

  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const [imageTab, setImageTab] = useState<'upload' | 'collection'>('upload');
  const [collectionImages, setCollectionImages] = useState<ProviderImage[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionLoaded, setCollectionLoaded] = useState(false);

  const loadCollection = useCallback(async () => {
    if (collectionLoaded) return;
    setCollectionLoading(true);
    try {
      const res = await imageCollectionService.getAll(0, 200);
      setCollectionImages(res.items);
      setCollectionLoaded(true);
    } catch {
      // silently ignore
    } finally {
      setCollectionLoading(false);
    }
  }, [collectionLoaded]);

  const handleTabChange = (tab: 'upload' | 'collection') => {
    setImageTab(tab);
    if (tab === 'collection') loadCollection();
  };

  const toggleCollectionImage = (img: ProviderImage) => {
    const isExisting = trip?.images?.includes(img.url) ?? false;
    if (selectedCollectionUrls.includes(img.url) || (isExisting && tripImages.includes(img.url))) {
      setSelectedCollectionUrls(prev => prev.filter(u => u !== img.url));
      setTripImages(prev => prev.filter(u => u !== img.url));
      if (isExisting) setImagesToDelete(prev => [...prev, img.url]);
    } else {
      setSelectedCollectionUrls(prev => [...prev, img.url]);
      setTripImages(prev => [...prev, img.url]);
    }
  };

  const isCollectionImageSelected = (img: ProviderImage) =>
    selectedCollectionUrls.includes(img.url) || (tripImages.includes(img.url) && (trip?.images?.includes(img.url) ?? false));

  const checkImageResolution = (file: File): Promise<{ ok: boolean; reason?: string }> =>
    new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const landscapeOk = w >= 800 && h >= 600;
        const portraitOk  = w >= 600 && h >= 800;
        if (landscapeOk || portraitOk) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, reason: `"${file.name}" is too small (${w}×${h} px). Minimum: 800×600 px.` });
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, reason: `"${file.name}" could not be read.` }); };
      img.src = url;
    });

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    const rejected: string[] = [];
    const accepted: File[] = [];

    await Promise.all(filesArray.map(async file => {
      const result = await checkImageResolution(file);
      if (result.ok) {
        accepted.push(file);
      } else {
        rejected.push(result.reason!);
      }
    }));

    setImageErrors(rejected);
    if (accepted.length > 0) setNewImageFiles(prev => [...prev, ...accepted]);
    e.target.value = '';
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

    // ── Date logic validation ──
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (end <= start) {
        newErrors.push(t('trip.validation.endAfterStart', 'End date/time must be after start date/time'));
      }
    }
    if (formData.registration_deadline && formData.start_date) {
      const deadline = new Date(formData.registration_deadline);
      const start = new Date(formData.start_date);
      if (deadline > start) {
        newErrors.push(t('trip.validation.deadlineBeforeStart', 'Registration deadline must be on or before the start date/time'));
      }
    }

    // ── Meeting place is mandatory for guided trips ──
    if (tripTypeSelection === TripType.GUIDED) {
      if (!formData.meeting_place_name.trim()) {
        newErrors.push(t('trip.validation.meetingPlaceNameRequired', 'Meeting place name is required for guided trips'));
      }
      if (!formData.meeting_location.trim()) {
        newErrors.push(t('trip.validation.meetingLocationRequired', 'Meeting location (Google Maps link) is required'));
      } else {
        const GMAPS_RE = /^https:\/\/(maps\.google\.com\/|www\.google\.com\/maps\/|goo\.gl\/maps\/|maps\.app\.goo\.gl\/)/i;
        if (!GMAPS_RE.test(formData.meeting_location)) {
          newErrors.push(t('trip.validation.invalidMapsUrl', 'Meeting location must be a Google Maps URL (e.g. https://maps.app.goo.gl/…)'));
        }
      }
    }

    if (isPackagedTrip) {
      // Packaged: require at least 2 packages
      if (packages.length < 2) {
        newErrors.push(t('trip.validation.minTwoPackages', 'Packaged trips require at least 2 tiers'));
      }
      packages.forEach((pkg, index) => {
        if (!(pkg.name_en ?? '').trim() && !(pkg.name_ar ?? '').trim()) {
          newErrors.push(t('trip.validation.packageNeedsName', 'Tier {{n}}: Name in at least one language is required', { n: index + 1 }));
        }
        if (!(pkg.description_en ?? '').trim() && !(pkg.description_ar ?? '').trim()) {
          newErrors.push(t('trip.validation.packageNeedsDesc', 'Tier {{n}}: Description in at least one language is required', { n: index + 1 }));
        }
        const pkgFlex = packageFlexiblePricing[index] ?? false;
        const pkgTiers = packagePricingTiers[index] ?? [];
        if (pkgFlex) {
          if (pkgTiers.length === 0) {
            newErrors.push(t('trip.validation.pkgTierRequired', { tier: index + 1 }));
          } else {
            if (pkgTiers[0].from_participant !== 1) {
              newErrors.push(t('trip.validation.pkgTierFirstAt1', { tier: index + 1 }));
            }
            const seenFrom = new Set<number>();
            pkgTiers.forEach((tier, ti) => {
              if (!tier.price_per_person || tier.price_per_person <= 0) {
                newErrors.push(t('trip.validation.pkgTierPrice', { tier: index + 1, band: ti + 1 }));
              }
              if (ti > 0 && tier.from_participant <= pkgTiers[ti - 1].from_participant) {
                newErrors.push(t('trip.validation.pkgTierAscending', { tier: index + 1, band: ti + 1, prev: pkgTiers[ti - 1].from_participant }));
              } else if (seenFrom.has(tier.from_participant)) {
                newErrors.push(t('trip.validation.pkgTierDuplicate', { tier: index + 1, band: ti + 1, val: tier.from_participant }));
              }
              seenFrom.add(tier.from_participant);
            });
          }
        } else if (!pkg.price || Number(pkg.price) < 1) {
          newErrors.push(t('trip.validation.packageMinPrice', 'Tier {{n}}: Price must be at least 1', { n: index + 1 }));
        }
        if (!pkg.max_participants || Number(pkg.max_participants) < 1) {
          newErrors.push(`Tier ${index + 1}: Max participants is required and must be at least 1`);
        }
      });
      // Validate that sum of tier max_participants equals trip max_participants
      const tripMax = parseInt(formData.max_participants, 10);
      if (!isNaN(tripMax)) {
        const tierSum = packages.reduce((sum, pkg) => sum + (Number(pkg.max_participants) || 0), 0);
        if (tierSum !== tripMax) {
          newErrors.push(
            `Tier participants total (${tierSum}) must equal the trip's max participants (${tripMax}). Please adjust tier capacities.`
          );
        }
      }
    } else {
      // Non-packaged: validate trip-level price (skip if flexible pricing is on)
      if (!tripFlexiblePricing && (!tripPrice || Number(tripPrice) < 1)) {
        newErrors.push(t('trip.validation.minPrice', 'Price must be at least 1'));
      }
      if (tripFlexiblePricing) {
        if (tripPricingTiers.length === 0) {
          newErrors.push(t('trip.validation.tierRequired'));
        } else {
          if (tripPricingTiers[0].from_participant !== 1) {
            newErrors.push(t('trip.validation.tierFirstAt1'));
          }
          const seenSimpleFrom = new Set<number>();
          tripPricingTiers.forEach((tier, ti) => {
            if (!tier.price_per_person || tier.price_per_person <= 0) {
              newErrors.push(t('trip.validation.tierPrice'));
            }
            if (ti > 0 && tier.from_participant <= tripPricingTiers[ti - 1].from_participant) {
              newErrors.push(t('trip.validation.tierAscending', { n: ti + 1, prev: tripPricingTiers[ti - 1].from_participant }));
            } else if (seenSimpleFrom.has(tier.from_participant)) {
              newErrors.push(t('trip.validation.tierDuplicate', { n: ti + 1, val: tier.from_participant }));
            }
            seenSimpleFrom.add(tier.from_participant);
          });
        }
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

    // Convert a datetime-local string (wall clock in trip's timezone) to a UTC ISO string.
    // We append the UTC offset for the trip's timezone at that moment, then let
    // the backend's UTC normaliser handle it.
    const localToUtcIso = (localStr: string): string => {
      if (!localStr) return localStr;
      // Normalise: strip any existing seconds to keep precision at the minute level,
      // then re-add :00 seconds before treating as UTC for offset calculation.
      const normalised = localStr.length === 16 ? localStr : localStr.substring(0, 16);
      const naive = new Date(normalised + ':00Z'); // treat as UTC first
      const tzOffset = (() => {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false,
        }).formatToParts(naive);
        const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0');
        const tzDate = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')));
        return (naive.getTime() - tzDate.getTime()) / 60000; // offset in minutes
      })();
      return new Date(naive.getTime() + tzOffset * 60000).toISOString();
    };

    const payload = {
        ...formData,
        is_packaged_trip: isPackagedTrip,
        trip_type: tripTypeSelection,
        has_meeting_place: tripTypeSelection === TripType.GUIDED,
        meeting_place_name: tripTypeSelection === TripType.GUIDED ? formData.meeting_place_name : undefined,
        meeting_place_name_ar: tripTypeSelection === TripType.GUIDED && formData.meeting_place_name_ar.trim() ? formData.meeting_place_name_ar : undefined,
        meeting_location: tripTypeSelection === TripType.GUIDED ? formData.meeting_location : undefined,
        max_participants: parseInt(formData.max_participants, 10),
        start_date: localToUtcIso(formData.start_date),
        end_date: localToUtcIso(formData.end_date),
        registration_deadline: formData.registration_deadline
          ? localToUtcIso(formData.registration_deadline)
          : undefined,
        starting_city_id: startingCityId || undefined,
        amenities: !isPackagedTrip && selectedAmenities.length > 0 ? selectedAmenities : undefined,
    };
    
    const imageData = {
      newImages: newImageFiles,
      imagesToDelete: imagesToDelete,
      collectionUrls: selectedCollectionUrls,
    };

    if (isPackagedTrip) {
      const packagesWithPricing: CreateTripPackage[] = packages.map((pkg, idx) => ({
        ...pkg,
        use_flexible_pricing: packageFlexiblePricing[idx] ?? false,
        pricing_tiers: (packageFlexiblePricing[idx] ?? false) ? (packagePricingTiers[idx] ?? []) : [],
      }));
      onSubmit(payload, packagesWithPricing, packageRequiredFields, packageValidationConfigs, imageData, destinationSelections, extraFees);
    } else {
      // Non-packaged: include price/is_refundable/amenities in the trip payload
      // Backend auto-creates/syncs the hidden package from these fields
      const nonPackagedPayload = {
        ...payload,
        price: tripFlexiblePricing ? 0 : (parseFloat(tripPrice as string) || 0),
        is_refundable: formData.is_refundable,
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
        use_flexible_pricing: tripFlexiblePricing,
        pricing_tiers: tripFlexiblePricing ? tripPricingTiers : [],
      };
      // Pass required fields as index 0 so new.tsx/edit.tsx can update the hidden package's fields
      const hiddenFields = { 0: tripRequiredFields };
      const hiddenValidations = { 0: tripValidationConfigs };
      onSubmit(nonPackagedPayload, null, hiddenFields, hiddenValidations, imageData, destinationSelections, extraFees);
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
            <input className={inputCls} name="name_en" value={formData.name_en} onChange={handleChange} placeholder={t('trip.nameEn')} maxLength={100} />
          </div>
          <div>
            <label className={labelCls}>{t('trip.nameAr')} <span className="font-normal text-slate-400">({t('trip.optionalIfEnglish')})</span></label>
            <input className={inputCls} name="name_ar" value={formData.name_ar} onChange={handleChange} placeholder={t('trip.nameAr')} dir="rtl" maxLength={100} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t('trip.descriptionEn')} <span className="font-normal text-slate-400">({t('trip.optionalIfArabic')})</span></label>
            <textarea className={inputCls} rows={3} name="description_en" value={formData.description_en} onChange={handleChange} placeholder={t('trip.descriptionEn')} maxLength={2000} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t('trip.descriptionAr')} <span className="font-normal text-slate-400">({t('trip.optionalIfEnglish')})</span></label>
            <textarea className={inputCls} rows={3} name="description_ar" value={formData.description_ar} onChange={handleChange} placeholder={t('trip.descriptionAr')} dir="rtl" maxLength={2000} />
          </div>
        </div>
      </div>

      {/* ── Dates ── */}
      <div className={sectionCls}>
        <p className={sectionTitleCls}>{t('trip.datesCapacity')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 -mt-2">
          {t('trip.timezoneAutoNote', 'Dates are entered in the timezone of the selected starting city ({{tz}}). This is set automatically.', { tz: timezone })}
        </p>
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
            <select className={inputCls} value={startingCityId} onChange={e => {
              setStartingCityId(e.target.value);
              const city = cities.find(c => c.id === e.target.value);
              if (city?.timezone) setTimezone(city.timezone);
            }} disabled={!selectedCountryId}>
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

      {/* ── Trip Nature (Guided vs Tourism Package) ── */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-700 p-5">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-base font-bold text-purple-800 dark:text-purple-300">{t('trip.tripNature')}</p>
        </div>
        <p className="text-xs text-purple-600 dark:text-purple-400 mb-4">{t('trip.tripNatureHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Guided Trip */}
          <label className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${tripTypeSelection === TripType.GUIDED ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
            <input type="radio" name="trip_nature" checked={tripTypeSelection === TripType.GUIDED} onChange={() => setTripTypeSelection(TripType.GUIDED)} className="accent-purple-500 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{t('trip.guidedTrip')}</span>
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); setShowGuidedTooltip(v => !v); setShowPackageTooltip(false); }}
                  className="text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition"
                  title={t('trip.whatIsThis')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" /></svg>
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('trip.guidedTripSubtitle')}</div>
              {showGuidedTooltip && (
                <div className="mt-2 p-2.5 bg-white dark:bg-slate-700 border border-purple-200 dark:border-purple-600 rounded-lg text-xs text-slate-700 dark:text-slate-300 shadow-md">
                  {t('trip.guidedTripTooltip')}
                </div>
              )}
            </div>
          </label>
          {/* Tourism Package */}
          <label className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${tripTypeSelection === TripType.SELF_ARRANGED ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
            <input type="radio" name="trip_nature" checked={tripTypeSelection === TripType.SELF_ARRANGED} onChange={() => { setTripTypeSelection(TripType.SELF_ARRANGED); setFormData(prev => ({ ...prev, has_meeting_place: false, meeting_location: '' })); }} className="accent-purple-500 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{t('trip.tourismPackage')}</span>
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); setShowPackageTooltip(v => !v); setShowGuidedTooltip(false); }}
                  className="text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition"
                  title={t('trip.whatIsThis')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" /></svg>
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('trip.tourismPackageSubtitle')}</div>
              {showPackageTooltip && (
                <div className="mt-2 p-2.5 bg-white dark:bg-slate-700 border border-purple-200 dark:border-purple-600 rounded-lg text-xs text-slate-700 dark:text-slate-300 shadow-md">
                  {t('trip.tourismPackageTooltip')}
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* ── Booking Tiers Toggle (single price vs multiple tiers) ── */}
      <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl border-2 border-sky-200 dark:border-sky-700 p-5">
        <p className="text-base font-bold text-sky-800 dark:text-sky-300 mb-1">{t('trip.tierStructure')}</p>
        <p className="text-xs text-sky-600 dark:text-sky-400 mb-4">{t('trip.tierStructureHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${!isPackagedTrip ? 'border-sky-500 bg-sky-100 dark:bg-sky-900/40' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
            <input type="radio" name="tier_structure" checked={!isPackagedTrip} onChange={() => setIsPackagedTrip(false)} className="accent-sky-500" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{t('trip.singlePrice')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('trip.singlePriceDesc')}</div>
            </div>
          </label>
          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${isPackagedTrip ? 'border-sky-500 bg-sky-100 dark:bg-sky-900/40' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
            <input type="radio" name="tier_structure" checked={isPackagedTrip} onChange={() => setIsPackagedTrip(true)} className="accent-sky-500" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{t('trip.multipleTiers')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('trip.multipleTiersDesc')}</div>
            </div>
          </label>
        </div>
      </div>

      {/* ── Non-packaged: trip-level price, refundability, amenities, required fields ── */}
      {!isPackagedTrip && (
        <div className={sectionCls}>
          <p className={sectionTitleCls}>{t('trip.pricePolicyFields')}</p>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>{t('trip.pricePerPerson')} (SAR)</label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs text-slate-500 dark:text-slate-400">{t('trip.flexiblePricing')}</span>
                <button
                  type="button"
                  onClick={() => setTripFlexiblePricing(prev => !prev)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${tripFlexiblePricing ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${tripFlexiblePricing ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
            {!tripFlexiblePricing ? (
              <input className={inputCls} type="number" value={tripPrice} onChange={e => setTripPrice(e.target.value)} placeholder={t('trip.pricePlaceholder')} min="1" step="0.01" />
            ) : (
              <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-3 space-y-2">
                <p className="text-xs text-sky-700 dark:text-sky-300 font-medium">{t('trip.flexiblePricingHint')}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t('trip.flexiblePricingExample')}</p>
                {tripPricingTiers.map((tier, tierIdx) => (
                  <div key={tierIdx} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 block">{t('trip.fromParticipant')}</label>
                      <input
                        className={inputCls + ' py-2'}
                        type="number" min="1"
                        value={tier.from_participant}
                        disabled={tierIdx === 0}
                        onChange={(e) => {
                          const updated = [...tripPricingTiers];
                          updated[tierIdx] = { ...updated[tierIdx], from_participant: parseInt(e.target.value) || 1 };
                          setTripPricingTiers(updated);
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 block">{t('trip.pricePerPersonBand')}</label>
                      <input
                        className={inputCls + ' py-2'}
                        type="number" min="0.01" step="0.01"
                        value={tier.price_per_person || ''}
                        onChange={(e) => {
                          const updated = [...tripPricingTiers];
                          updated[tierIdx] = { ...updated[tierIdx], price_per_person: parseFloat(e.target.value) || 0 };
                          setTripPricingTiers(updated);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    {tierIdx > 0 && (
                      <button
                        type="button"
                        title={t('trip.removePricingBand')}
                        onClick={() => setTripPricingTiers(prev => prev.filter((_, i) => i !== tierIdx))}
                        className="mt-5 p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const lastFrom = tripPricingTiers[tripPricingTiers.length - 1]?.from_participant ?? 1;
                    setTripPricingTiers(prev => [...prev, { from_participant: lastFrom + 1, price_per_person: 0 }]);
                  }}
                  className="text-xs text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1 hover:underline mt-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {t('trip.addPricingBand')}
                </button>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" name="is_refundable" checked={formData.is_refundable} onChange={handleChange} className="w-4 h-4 accent-sky-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('trip.refundable')}</span>
          </label>
          <div className="mb-4">
            <p className={labelCls}>{t('trip.amenities')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {amenityKeys.map(value => (
                <label key={value} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm font-medium transition ${selectedAmenities.includes(value) ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                  <input type="checkbox" checked={selectedAmenities.includes(value)} onChange={() => toggleAmenity(value)} className="accent-sky-500 flex-shrink-0" />
                  {t(`amenity.${value}`)}
                </label>
              ))}
            </div>
            {selectedAmenities.includes('omra_assistance') && !destinationSelections.some(d => d._destinationName.toLowerCase().includes('makkah') || d._destinationName.includes('مكة') || d._destinationName.includes('مكه')) && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">⚠ Omra Assistance is typically for trips to Makkah. Make sure the destination is set accordingly.</p>
            )}
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

      {/* ── Meeting Place (guided trips only — always required) ── */}
      {tripTypeSelection === TripType.GUIDED && (
        <div className={sectionCls}>
          <p className={sectionTitleCls}>{t('trip.meetingPlace')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-4">{t('trip.meetingPlaceGuidedNote', 'Meeting place is required for guided trips.')}</p>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelCls}>{t('trip.meetingPlaceName', 'Meeting Place Name')} <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">English</label>
                  <input
                    className={inputCls}
                    type="text"
                    name="meeting_place_name"
                    value={formData.meeting_place_name}
                    onChange={handleChange}
                    placeholder={t('trip.meetingPlaceNamePlaceholder', 'e.g. King Fahd Gate, Masjid Al-Haram entrance')}
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">Arabic (optional)</label>
                  <input
                    className={inputCls}
                    type="text"
                    name="meeting_place_name_ar"
                    value={formData.meeting_place_name_ar}
                    onChange={handleChange}
                    placeholder="مثال: بوابة الملك فهد"
                    dir="rtl"
                    maxLength={200}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('trip.meetingLocation')} <span className="text-red-500">*</span></label>
              <input
                className={`${inputCls} ${
                  formData.meeting_location.trim() &&
                  !/^https:\/\/(maps\.google\.com\/|www\.google\.com\/maps\/|goo\.gl\/maps\/|maps\.app\.goo\.gl\/)/i.test(formData.meeting_location)
                    ? 'border-red-400 focus:ring-red-400'
                    : ''
                }`}
                type="text"
                name="meeting_location"
                value={formData.meeting_location}
                onChange={handleChange}
                placeholder="https://maps.app.goo.gl/..."
                maxLength={500}
              />
              {formData.meeting_location.trim() && !/^https:\/\/(maps\.google\.com\/|www\.google\.com\/maps\/|goo\.gl\/maps\/|maps\.app\.goo\.gl\/)/i.test(formData.meeting_location) ? (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {t('trip.validation.invalidMapsUrl', 'Must be a Google Maps URL (e.g. https://maps.app.goo.gl/…)')}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  {t('trip.meetingLocationHint', 'Paste a Google Maps link. Users in the app can tap it to open the location.')}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('trip.meetingTimeNote', 'Meeting time is set to the trip start time.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Extra Fees ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={sectionTitleCls}>{t('trip.extraFees', 'Additional Fees')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">{t('trip.extraFeesHint', 'Optional fees participants should be aware of (e.g. visa fees, airport taxes).')}</p>
          </div>
          <button
            type="button"
            onClick={addExtraFee}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('trip.addFee', 'Add Fee')}
          </button>
        </div>

        {extraFees.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            {t('trip.noExtraFees', 'No additional fees. Click "Add Fee" to add one.')}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {extraFees.map((fee, index) => (
              <div key={index} className="relative border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => removeExtraFee(index)}
                  className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title={t('trip.removeFee', 'Remove fee')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
                  <div>
                    <label className={labelCls}>{t('trip.feeNameEn', 'Fee Name (EN)')}</label>
                    <input className={inputCls} value={fee.name_en} onChange={e => updateExtraFee(index, 'name_en', e.target.value)} placeholder="e.g. Airport Tax" maxLength={100} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('trip.feeNameAr', 'Fee Name (AR)')}</label>
                    <input className={inputCls} value={fee.name_ar} onChange={e => updateExtraFee(index, 'name_ar', e.target.value)} placeholder="مثال: ضريبة المطار" dir="rtl" maxLength={100} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('trip.feeDescEn', 'Description (EN)')}</label>
                    <input className={inputCls} value={fee.description_en ?? ''} onChange={e => updateExtraFee(index, 'description_en', e.target.value)} placeholder={t('trip.optional', 'Optional')} maxLength={500} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('trip.feeDescAr', 'Description (AR)')}</label>
                    <input className={inputCls} value={fee.description_ar ?? ''} onChange={e => updateExtraFee(index, 'description_ar', e.target.value)} placeholder={t('trip.optional', 'Optional')} dir="rtl" maxLength={500} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('trip.feeAmount', 'Amount')} <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 w-full">
                      <input
                        className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition placeholder-slate-400 dark:placeholder-slate-500"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={fee.amount || ''}
                        onChange={e => updateExtraFee(index, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      <select
                        className="w-24 flex-shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                        value={fee.currency}
                        onChange={e => updateExtraFee(index, 'currency', e.target.value)}
                      >
                        <option value="SAR">SAR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="AED">AED</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-end pb-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fee.is_mandatory ?? true}
                        onChange={e => updateExtraFee(index, 'is_mandatory', e.target.checked)}
                        className="w-4 h-4 accent-sky-500"
                      />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('trip.feeMandatory', 'Mandatory fee')}</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Images ── */}
      <div className={sectionCls}>
        <p className={sectionTitleCls}>{t('trip.images')}</p>

        {/* Current images preview */}
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

        {/* Tab switcher */}
        <div className="flex gap-1 mb-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => handleTabChange('upload')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              imageTab === 'upload'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t('trip.images.uploadNew', 'Upload new')}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('collection')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              imageTab === 'collection'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t('trip.images.reuseCollection', 'Reuse from collection')}
          </button>
        </div>

        {/* Upload tab */}
        {imageTab === 'upload' && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {t('trip.imagesDescription')} <span className="font-semibold">JPG, PNG, WEBP</span>
              {' · '}{t('trip.imagesMinRes', 'Min. 800×600 px')}
            </p>
            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={handleImageFileChange} className="hidden" id="trip-image-upload" />
            <label htmlFor="trip-image-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg cursor-pointer transition">
              + {t('form.addImages')}
            </label>
          </div>
        )}

        {/* Collection tab */}
        {imageTab === 'collection' && (
          <div>
            {collectionLoading && (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500 dark:text-slate-400">
                <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                {t('trip.images.loadingCollection', 'Loading collection…')}
              </div>
            )}
            {!collectionLoading && collectionImages.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-4">
                {t('trip.images.collectionEmpty', 'Your collection is empty. Upload images to a trip first and they will appear here.')}
              </p>
            )}
            {!collectionLoading && collectionImages.length > 0 && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {t('trip.images.collectionHint', 'Click an image to add it to this trip. Click again to remove it.')}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
                  {collectionImages.map((img) => {
                    const selected = isCollectionImageSelected(img);
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => toggleCollectionImage(img)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                          selected
                            ? 'border-sky-500 ring-2 ring-sky-300'
                            : 'border-slate-200 dark:border-slate-700 hover:border-sky-300'
                        }`}
                      >
                        <img src={img.url} alt={img.original_filename || ''} className="w-full h-24 object-cover" />
                        {selected && (
                          <div className="absolute inset-0 bg-sky-500/20 flex items-center justify-center">
                            <div className="bg-sky-500 rounded-full w-6 h-6 flex items-center justify-center shadow">
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {imageErrors.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
              {t('trip.imageRejected', 'The following images were rejected:')}
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              {imageErrors.map((msg, i) => (
                <li key={i} className="text-xs text-red-600 dark:text-red-400">{msg}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setImageErrors([])}
              className="mt-2 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 underline"
            >
              {t('common.dismiss', 'Dismiss')}
            </button>
          </div>
        )}
      </div>

      {/* ── Packaged: multi-package section ── */}
      {isPackagedTrip && (
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-1">
            <p className={sectionTitleCls + ' mb-0'}>{t('tier.tiers')} <span className="text-sm font-normal text-slate-400">({t('tier.minRequired')})</span></p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('tier.provideOneLanguage')}</p>
          {/* Live participants counter */}
          {(() => {
            const tripMax = parseInt(formData.max_participants, 10);
            const allHaveMax = packages.every(pkg => pkg.max_participants != null && Number(pkg.max_participants) > 0);
            const tierSum = packages.reduce((s, pkg) => s + (Number(pkg.max_participants) || 0), 0);
            const hasAnyMax = packages.some(pkg => pkg.max_participants != null && Number(pkg.max_participants) > 0);
            if (!hasAnyMax || isNaN(tripMax)) return null;
            const ok = allHaveMax && tierSum === tripMax;
            const over = allHaveMax && tierSum > tripMax;
            return (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold mb-4 ${
                ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : over ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}>
                <span>{ok ? '✓' : '⚠'}</span>
                <span>{t('trip.tierTotal', { sum: tierSum, max: isNaN(tripMax) ? '?' : tripMax })}
                  {!ok && !isNaN(tripMax) && ` — ${tripMax - tierSum > 0 ? t('trip.tierTotalRemaining', { count: tripMax - tierSum }) : t('trip.tierTotalOver', { count: tierSum - tripMax })}`}
                </span>
              </div>
            );
          })()}
          <div className="flex flex-col gap-4">
            {packages.map((pkg, index) => (
              <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('tier.tierNumber', { number: index + 1 })}</p>
                  {packages.length > 2 ? (
                    <button type="button" onClick={() => removePackage(index)} className="text-xs text-red-600 hover:text-red-700 font-semibold">{t('form.removeTier')}</button>
                  ) : (
                    <span className="text-xs text-slate-400">(min 2 {t('common.required')})</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>{t('tier.nameEn')} <span className="font-normal text-slate-400">({t('common.optional')})</span></label>
                    <input className={inputCls} value={pkg.name_en} onChange={(e) => updatePackage(index, 'name_en', e.target.value)} placeholder={t('tier.nameEn')} maxLength={100} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('tier.nameAr')} <span className="font-normal text-slate-400">({t('common.optional')})</span></label>
                    <input className={inputCls} value={pkg.name_ar} onChange={(e) => updatePackage(index, 'name_ar', e.target.value)} placeholder={t('tier.nameAr')} dir="rtl" maxLength={100} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('tier.descriptionEn')} <span className="font-normal text-slate-400">({t('common.optional')})</span></label>
                    <textarea className={inputCls} rows={2} value={pkg.description_en} onChange={(e) => updatePackage(index, 'description_en', e.target.value)} placeholder={t('tier.descriptionEn')} maxLength={1000} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('tier.descriptionAr')} <span className="font-normal text-slate-400">({t('common.optional')})</span></label>
                    <textarea className={inputCls} rows={2} value={pkg.description_ar} onChange={(e) => updatePackage(index, 'description_ar', e.target.value)} placeholder={t('tier.descriptionAr')} dir="rtl" maxLength={1000} />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelCls + ' mb-0'}>{t('tier.price')} (SAR)</label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('trip.flexiblePricing')}</span>
                        <button
                          type="button"
                          onClick={() => setPackageFlexiblePricing(prev => ({ ...prev, [index]: !(prev[index] ?? false) }))}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${packageFlexiblePricing[index] ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${packageFlexiblePricing[index] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                    </div>
                    {!packageFlexiblePricing[index] ? (
                      <input className={inputCls} type="number" value={pkg.price || ''} onChange={(e) => updatePackage(index, 'price', parseFloat(e.target.value) || 0)} placeholder={t('package.pricePlaceholder', 'e.g. 250')} min="1" step="0.01" required />
                    ) : (
                      <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-3 space-y-2">
                        <p className="text-xs text-sky-700 dark:text-sky-300 font-medium">{t('trip.flexiblePricingHint')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t('trip.flexiblePricingExample')}</p>
                        {(packagePricingTiers[index] ?? [{ from_participant: 1, price_per_person: 0 }]).map((tier, tierIdx) => (
                          <div key={tierIdx} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 block">{t('trip.fromParticipant')}</label>
                              <input
                                className={inputCls + ' py-2'}
                                type="number"
                                min="1"
                                value={tier.from_participant}
                                disabled={tierIdx === 0}
                                onChange={(e) => {
                                  const updated = [...(packagePricingTiers[index] ?? [])];
                                  updated[tierIdx] = { ...updated[tierIdx], from_participant: parseInt(e.target.value) || 1 };
                                  setPackagePricingTiers(prev => ({ ...prev, [index]: updated }));
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 block">{t('trip.pricePerPersonBand')}</label>
                              <input
                                className={inputCls + ' py-2'}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={tier.price_per_person || ''}
                                onChange={(e) => {
                                  const updated = [...(packagePricingTiers[index] ?? [])];
                                  updated[tierIdx] = { ...updated[tierIdx], price_per_person: parseFloat(e.target.value) || 0 };
                                  setPackagePricingTiers(prev => ({ ...prev, [index]: updated }));
                                }}
                                placeholder="0.00"
                              />
                            </div>
                            {tierIdx > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (packagePricingTiers[index] ?? []).filter((_, i) => i !== tierIdx);
                                  setPackagePricingTiers(prev => ({ ...prev, [index]: updated }));
                                }}
                                className="mt-5 p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                                title={t('trip.removePricingBand')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const current = packagePricingTiers[index] ?? [{ from_participant: 1, price_per_person: 0 }];
                            const lastFrom = current[current.length - 1]?.from_participant ?? 1;
                            setPackagePricingTiers(prev => ({
                              ...prev,
                              [index]: [...current, { from_participant: lastFrom + 1, price_per_person: 0 }]
                            }));
                          }}
                          className="text-xs text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1 hover:underline mt-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          {t('trip.addPricingBand')}
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>{t('tier.maxParticipants')}</label>
                    <input className={inputCls} type="number" value={pkg.max_participants ?? ''} onChange={(e) => updatePackage(index, 'max_participants', parseInt(e.target.value) || 0)} placeholder={t('tier.maxParticipantsPlaceholder')} min="1" />
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input type="checkbox" checked={pkg.is_refundable ?? false} onChange={(e) => updatePackage(index, 'is_refundable', e.target.checked)} className="w-4 h-4 accent-sky-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('trip.refundable')}</span>
                </label>
                <div className="mb-3">
                  <p className={labelCls}>{t('trip.amenities')}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {amenityKeys.map(value => {
                      const pkgAmenities = pkg.amenities ?? [];
                      return (
                        <label key={value} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-medium transition ${pkgAmenities.includes(value) ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                          <input type="checkbox" checked={pkgAmenities.includes(value)} onChange={() => { const updated = pkgAmenities.includes(value) ? pkgAmenities.filter(a => a !== value) : [...pkgAmenities, value]; updatePackage(index, 'amenities', updated as any); }} className="accent-sky-500 flex-shrink-0" />
                          {t(`amenity.${value}`)}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className={labelCls}>{t('tier.requiredFields')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('tier.nameDOBAlwaysRequired')}</p>
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
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{i18n.language === 'ar' && field.display_name_ar ? field.display_name_ar : field.display_name}</span>
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
            + {t('form.addTier')}
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
