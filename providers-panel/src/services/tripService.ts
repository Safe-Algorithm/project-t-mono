import { api } from './api';
import { Trip, TripPackage, CreateTripPackage, UpdateTripPackage, PackageRequiredField, FieldMetadata, ValidationMetadata, ValidationConfig } from '../types/trip';

export interface TripCreatePayload {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  price: number;
  max_participants: number;
  trip_metadata?: Record<string, any>;
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
  getAvailableFields: (): Promise<{ fields: FieldMetadata[] }> => {
    return api.get<{ fields: FieldMetadata[] }>('/trips/available-fields');
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
};
