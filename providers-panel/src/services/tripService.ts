import { api } from './api';
import i18n from '../i18n';
import { Trip, TripPackage, TripExtraFee, CreateTripExtraFee, CreateTripPackage, UpdateTripPackage, PackageRequiredField, FieldMetadata, ValidationMetadata, ValidationConfig, PhoneCountry, NationalityOption } from '../types/trip';

export interface TripCreatePayload {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  start_date: string;
  end_date: string;
  registration_deadline?: string;
  max_participants: number;
  is_packaged_trip?: boolean;
  trip_type?: string;
  trip_metadata?: Record<string, any>;
  price?: number;
  is_refundable?: boolean;
  amenities?: string[];
  has_meeting_place?: boolean;
  meeting_place_name?: string;
  meeting_location?: string;
  meeting_time?: string;
  starting_city_id?: string;
}

export interface TripUpdatePayload extends Partial<TripCreatePayload> {
  is_active?: boolean;
}

export interface TripFilterParams {
  search?: string;
  start_date_from?: string;
  start_date_to?: string;
  min_price?: number;
  max_price?: number;
  min_participants?: number;
  max_participants?: number;
  min_rating?: number;
  is_active?: boolean;
  skip?: number;
  limit?: number;
}

export const tripService = {
  getAll: (filters?: TripFilterParams): Promise<Trip[]> => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.search) params.append('search', filters.search);
      if (filters.start_date_from) params.append('start_date_from', filters.start_date_from);
      if (filters.start_date_to) params.append('start_date_to', filters.start_date_to);
      if (filters.min_price !== undefined) params.append('min_price', filters.min_price.toString());
      if (filters.max_price !== undefined) params.append('max_price', filters.max_price.toString());
      if (filters.min_participants !== undefined) params.append('min_participants', filters.min_participants.toString());
      if (filters.max_participants !== undefined) params.append('max_participants', filters.max_participants.toString());
      if (filters.min_rating !== undefined) params.append('min_rating', filters.min_rating.toString());
      if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters.skip !== undefined) params.append('skip', filters.skip.toString());
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    }
    const queryString = params.toString();
    return api.get<Trip[]>(`/trips/${queryString ? `?${queryString}` : ''}`);
  },

  getById: (id: string): Promise<Trip> => {
    return api.get<Trip>(`/trips/${id}`);
  },

  create: (payload: TripCreatePayload): Promise<Trip> => {
    return api.post<Trip>('/trips/', payload);
  },

  update: (id: string, payload: TripUpdatePayload): Promise<Trip> => {
    return api.put<Trip>(`/trips/${id}`, payload);
  },

  delete: (id: string): Promise<void> => {
    return api.del<void>(`/trips/${id}`);
  },

  // Package management
  createPackage: (tripId: string, payload: CreateTripPackage): Promise<TripPackage> => {
    return api.post<TripPackage>(`/trips/${tripId}/packages`, payload);
  },

  getPackages: (tripId: string): Promise<TripPackage[]> => {
    return api.get<TripPackage[]>(`/trips/${tripId}/packages`);
  },

  updatePackage: (tripId: string, packageId: string, payload: UpdateTripPackage): Promise<TripPackage> => {
    return api.put<TripPackage>(`/trips/${tripId}/packages/${packageId}`, payload);
  },

  deletePackage: (tripId: string, packageId: string): Promise<void> => {
    return api.del<void>(`/trips/${tripId}/packages/${packageId}`);
  },

  // Package required fields management
  setPackageRequiredFields: (tripId: string, packageId: string, fields: PackageRequiredField[]): Promise<void> => {
    const fieldTypes = fields.map(field => field.field_type);
    return api.post<void>(`/trips/${tripId}/packages/${packageId}/required-fields`, fieldTypes);
  },

  setPackageRequiredFieldsWithValidation: (tripId: string, packageId: string, fields: PackageRequiredField[]): Promise<void> => {
    return api.post<void>(`/trips/${tripId}/packages/${packageId}/required-fields-with-validation`, {
      required_fields: fields
    });
  },

  getPackageRequiredFields: (tripId: string, packageId: string): Promise<string[]> => {
    return api.get<string[]>(`/trips/${tripId}/packages/${packageId}/required-fields`);
  },

  // Get available field metadata
  getAvailableFields: async (): Promise<{ fields: FieldMetadata[] }> => {
    const token = localStorage.getItem('provider_access_token');
    const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1`;
    const response = await fetch(`${BASE_URL}/trips/available-fields`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'providers_panel',
        'Accept-Language': i18n.language === 'ar' ? 'ar' : 'en',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to load available fields');
    return response.json();
  },

  // Validation management
  getAvailableValidations: (fieldType: string): Promise<Record<string, ValidationMetadata>> => {
    return api.get<Record<string, ValidationMetadata>>(`/trips/validation/available/${fieldType}`);
  },

  getAllValidationMetadata: (): Promise<Record<string, ValidationMetadata>> => {
    return api.get<Record<string, ValidationMetadata>>('/trips/validation/metadata');
  },

  validateConfig: (fieldType: string, validationConfig: ValidationConfig): Promise<{ is_valid: boolean; errors: string[] }> => {
    return api.post<{ is_valid: boolean; errors: string[] }>('/trips/validation/validate-config', {
      field_type: fieldType,
      validation_config: validationConfig
    });
  },

  validateValue: (fieldType: string, value: string, validationConfig: ValidationConfig): Promise<{ is_valid: boolean; errors: string[] }> => {
    return api.post<{ is_valid: boolean; errors: string[] }>('/trips/validation/validate-value', {
      field_type: fieldType,
      value: value,
      validation_config: validationConfig
    });
  },

  getPhoneCountries: (): Promise<{ countries: PhoneCountry[] }> => {
    return api.get<{ countries: PhoneCountry[] }>('/trips/validation/phone-countries');
  },

  getNationalities: (): Promise<{ nationalities: NationalityOption[] }> => {
    return api.get<{ nationalities: NationalityOption[] }>('/trips/validation/nationalities');
  },

  uploadImages: async (tripId: string, images: File[]): Promise<{ message: string; uploaded_urls: string[]; total_images: number; failed: { filename: string; reason: string }[] }> => {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('files', image);
    });

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trips/${tripId}/upload-images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('provider_access_token')}`,
        'X-Source': 'providers_panel',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to upload images');
    }

    return response.json();
  },

  // Extra fees management
  createExtraFee: (tripId: string, payload: CreateTripExtraFee): Promise<TripExtraFee> => {
    return api.post<TripExtraFee>(`/trips/${tripId}/extra-fees`, payload);
  },

  getExtraFees: (tripId: string): Promise<TripExtraFee[]> => {
    return api.get<TripExtraFee[]>(`/trips/${tripId}/extra-fees`);
  },

  deleteExtraFee: (tripId: string, feeId: string): Promise<void> => {
    return api.del<void>(`/trips/${tripId}/extra-fees/${feeId}`);
  },

  duplicate: (tripId: string): Promise<Trip> => {
    return api.post<Trip>(`/trips/${tripId}/duplicate`, {});
  },

  startProcessing: (tripId: string, registrationId: string): Promise<{ id: string; status: string; processing_started_at: string }> => {
    return api.post(`/trips/${tripId}/registrations/${registrationId}/start-processing`, {});
  },

  confirmProcessing: (tripId: string, registrationId: string): Promise<{ id: string; status: string }> => {
    return api.post(`/trips/${tripId}/registrations/${registrationId}/confirm-processing`, {});
  },

  deleteImage: async (tripId: string, imageUrl: string): Promise<{ message: string; remaining_images: number }> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trips/${tripId}/images?image_url=${encodeURIComponent(imageUrl)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('provider_access_token')}`,
        'Content-Type': 'application/json',
        'X-Source': 'providers_panel',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete image');
    }

    return response.json();
  },
};
