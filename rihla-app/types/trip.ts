export interface TripPackageRequiredField {
  id: string;
  package_id: string;
  field_type: string;
  is_required: boolean;
  validation_config?: Record<string, any>;
}

export interface TripPackage {
  id: string;
  trip_id: string;
  name_en: string | null;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  price: string | number;
  currency: string;
  is_active: boolean;
  max_participants?: number | null;
  available_spots?: number | null;
  is_refundable?: boolean | null;
  amenities?: string[] | null;
  required_fields: string[];
  required_fields_details?: TripPackageRequiredField[];
}

export interface TripExtraFee {
  id: string;
  trip_id: string;
  name_en: string | null;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  amount: string | number;
  currency: string;
}

export interface TripProvider {
  id: string;
  company_name: string;
}

export interface StartingCity {
  id: string;
  name_en: string;
  name_ar: string;
  country_code: string;
}

export interface DestinationInfo {
  id: string;
  name_en: string;
  name_ar: string;
  country_code: string;
  type: string;
}

export interface Trip {
  id: string;
  provider_id: string;
  provider: TripProvider;
  name_en: string | null;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  max_participants: number;
  timezone?: string;
  available_spots: number;
  is_active: boolean;
  is_packaged_trip: boolean;
  price?: number | null;
  is_refundable?: boolean | null;
  is_international: boolean;
  starting_city_id: string | null;
  starting_city: StartingCity | null;
  destinations: DestinationInfo[];
  trip_type: string;
  amenities?: string[] | null;
  has_meeting_place: boolean;
  meeting_place_name: string | null;
  meeting_place_name_ar: string | null;
  meeting_location: string | null;
  meeting_time: string | null;
  images: string[] | null;
  trip_metadata?: Record<string, any> | null;
  packages: TripPackage[];
  extra_fees: TripExtraFee[];
  average_rating?: number;
  total_reviews?: number;
}

export interface TripRating {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<string, number>;
}

export interface Review {
  id: string;
  trip_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string | null;
  images: string[] | null;
  created_at: string;
}

export interface RegistrationParticipant {
  id: string;
  registration_id: string;
  registration_user_id: string;
  package_id: string | null;
  is_registration_user: boolean;
  name: string | null;
  passport_number: string | null;
  id_iqama_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  nationality: string | null;
  disability: string | null;
  medical_conditions: string | null;
  allergies: string | null;
  [key: string]: any;
}

export interface RegistrationTripInfo {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  start_date: string;
  end_date: string;
  provider_id: string;
  trip_reference: string;
  provider: { id: string; company_name: string };
}


export interface TripRegistration {
  id: string;
  trip_id: string;
  user_id: string;
  status: string;
  registration_date: string;
  total_participants: number;
  total_amount: string | number;
  spot_reserved_until: string | null;
  booking_reference: string;
  participants: RegistrationParticipant[];
  trip: RegistrationTripInfo;
}

export interface TripUpdate {
  id: string;
  trip_id: string;
  registration_id: string | null;
  provider_id: string;
  title: string;
  message: string;
  is_important: boolean;
  attachments?: TripUpdateAttachment[] | null;
  created_at: string;
  read: boolean;
}

export interface TripUpdateAttachment {
  url: string;
  filename: string;
  content_type: string;
}

export interface ProviderProfile {
  id: string;
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_avatar_url: string | null;
  company_cover_url: string | null;
  company_metadata: Record<string, any> | null;
  bio_en: string | null;
  bio_ar: string | null;
  total_trips: number;
  active_trips: number;
  average_rating: number;
  total_reviews: number;
}
