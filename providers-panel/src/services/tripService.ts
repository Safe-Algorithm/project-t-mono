import { api } from './api';
import { Trip, TripPackage, CreateTripPackage, UpdateTripPackage, PackageRequiredField, FieldMetadata } from '../types/trip';

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

export const tripService = {
  getAll: (): Promise<Trip[]> => {
    return api.get<Trip[]>('/trips/');
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

  getPackageRequiredFields: (tripId: string, packageId: string): Promise<string[]> => {
    return api.get<string[]>(`/trips/${tripId}/packages/${packageId}/required-fields`);
  },

  // Get available field metadata
  getAvailableFields: (): Promise<{ fields: FieldMetadata[] }> => {
    return api.get<{ fields: FieldMetadata[] }>('/trips/available-fields');
  },
};
