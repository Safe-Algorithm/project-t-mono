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
  is_active: boolean;
  display_order: number;
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
  is_active: boolean;
  display_order: number;
}

export interface TripDestination {
  id: string;
  trip_id: string;
  destination_id: string;
  place_id: string | null;
  created_at: string;
  destination: Destination | null;
  place: Place | null;
}

export const destinationService = {
  // Public - get active destinations tree
  getActiveDestinations: (): Promise<Destination[]> => {
    return api.get<Destination[]>('/destinations');
  },

  // Public - get places for a destination
  getPlaces: (destinationId: string): Promise<Place[]> => {
    return api.get<Place[]>(`/destinations/${destinationId}/places`);
  },

  // Provider - trip destination management
  addTripDestination: (tripId: string, destinationId: string, placeId?: string): Promise<TripDestination> => {
    const body: any = { destination_id: destinationId };
    if (placeId) body.place_id = placeId;
    return api.post<TripDestination>(`/trips/${tripId}/destinations`, body);
  },

  removeTripDestination: (tripId: string, tripDestinationId: string): Promise<void> => {
    return api.del<void>(`/trips/${tripId}/destinations/${tripDestinationId}`);
  },

  getTripDestinations: (tripId: string): Promise<TripDestination[]> => {
    return api.get<TripDestination[]>(`/trips/${tripId}/destinations`);
  },
};
