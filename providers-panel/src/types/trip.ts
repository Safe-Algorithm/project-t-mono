export interface ValidationConfig {
  [validationType: string]: Record<string, any>;
}

export interface ValidationMetadata {
  name: string;
  display_name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    default?: any;
  }>;
}

export interface TripPackageRequiredField {
  id: string;
  package_id: string;
  field_type: string;
  is_required: boolean;
  validation_config?: ValidationConfig;
}

export interface TripPackage {
  id: string; // uuid
  trip_id: string; // uuid
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  price: number;
  currency: string;
  is_active: boolean;
  max_participants?: number | null;
  is_refundable?: boolean | null;
  amenities?: string[] | null;
  required_fields: string[];
  required_fields_details?: TripPackageRequiredField[];
}

export interface Trip {
  id: string; // uuid
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  start_date: string; // datetime
  end_date: string; // datetime
  registration_deadline?: string | null;
  max_participants: number;
  is_active: boolean;
  is_packaged_trip: boolean;
  is_international?: boolean;
  starting_city_id?: string | null;
  provider_id: string; // uuid
  images?: string[];
  trip_metadata?: Record<string, any>;
  packages: TripPackage[];
  is_refundable?: boolean;
  amenities?: string[];
  has_meeting_place?: boolean;
  meeting_location?: string;
  meeting_time?: string;
  extra_fees?: TripExtraFee[];
  price?: number | null;
}

export interface TripExtraFee {
  id: string;
  trip_id: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  amount: number;
  currency: string;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTripExtraFee {
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  amount: number;
  currency?: string;
  is_mandatory?: boolean;
}

export enum TripAmenity {
  FLIGHT_TICKETS = 'flight_tickets',
  BUS = 'bus',
  TOUR_GUIDE = 'tour_guide',
  TOURS = 'tours',
  HOTEL = 'hotel',
  MEALS = 'meals',
  INSURANCE = 'insurance',
  VISA_ASSISTANCE = 'visa_assistance',
}

export interface CreateTripPackage {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  price: number;
  currency: string;
  max_participants?: number | null;
  is_refundable?: boolean | null;
  amenities?: string[] | null;
}

export interface UpdateTripPackage {
  name_en?: string;
  name_ar?: string;
  description_en?: string;
  description_ar?: string;
  price?: number;
  currency?: string;
  is_active?: boolean;
}

export interface PackageRequiredField {
  field_type: string;
  validation_config?: ValidationConfig;
}

export interface FieldMetadata {
  field_name: string;
  display_name: string;
  ui_type: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  available_validations?: string[];
}
