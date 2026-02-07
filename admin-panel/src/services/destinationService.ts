import { api } from './api';

export interface Destination {
  id: string;
  type: 'country' | 'city';
  parent_id: string | null;
  country_code: string;
  slug: string;
  full_slug: string;
  name_en: string;
  name_ar: string;
  timezone: string | null;
  currency_code: string | null;
  google_place_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  children?: Destination[];
  places?: Place[];
}

export interface Place {
  id: string;
  destination_id: string;
  type: string;
  slug: string;
  name_en: string;
  name_ar: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDestination {
  type: 'country' | 'city';
  parent_id?: string | null;
  country_code: string;
  slug: string;
  name_en: string;
  name_ar: string;
  timezone?: string;
  currency_code?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateDestination {
  name_en?: string;
  name_ar?: string;
  slug?: string;
  timezone?: string;
  currency_code?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface CreatePlace {
  type: string;
  slug: string;
  name_en: string;
  name_ar: string;
  latitude?: number;
  longitude?: number;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdatePlace {
  type?: string;
  slug?: string;
  name_en?: string;
  name_ar?: string;
  latitude?: number;
  longitude?: number;
  is_active?: boolean;
  display_order?: number;
}

export const destinationService = {
  // Admin endpoints
  getAll: (type?: string): Promise<Destination[]> => {
    const query = type ? `?type=${type}` : '';
    return api.get<Destination[]>(`/admin/destinations${query}`);
  },

  getById: (id: string): Promise<Destination> => {
    return api.get<Destination>(`/admin/destinations/${id}`);
  },

  create: (data: CreateDestination): Promise<Destination> => {
    return api.post<Destination>('/admin/destinations', data);
  },

  update: (id: string, data: UpdateDestination): Promise<Destination> => {
    return api.patch<Destination>(`/admin/destinations/${id}`, data);
  },

  delete: (id: string): Promise<void> => {
    return api.del<void>(`/admin/destinations/${id}`);
  },

  activate: (id: string, isActive: boolean): Promise<Destination> => {
    return api.patch<Destination>(`/admin/destinations/${id}/activate?is_active=${isActive}`, {});
  },

  // Place endpoints
  createPlace: (destinationId: string, data: CreatePlace): Promise<Place> => {
    return api.post<Place>(`/admin/destinations/${destinationId}/places`, data);
  },

  getPlaces: (destinationId: string): Promise<Place[]> => {
    return api.get<Place[]>(`/admin/destinations/${destinationId}/places`);
  },

  updatePlace: (placeId: string, data: UpdatePlace): Promise<Place> => {
    return api.patch<Place>(`/admin/places/${placeId}`, data);
  },

  deletePlace: (placeId: string): Promise<void> => {
    return api.del<void>(`/admin/places/${placeId}`);
  },
};
