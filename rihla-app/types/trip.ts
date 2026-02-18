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
  required_fields: string[];
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

export interface Trip {
  id: string;
  provider_id: string;
  provider?: TripProvider;
  name_en: string | null;
  name_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  start_date: string;
  end_date: string;
  max_participants: number;
  is_active: boolean;
  is_refundable: boolean;
  amenities: string[] | null;
  has_meeting_place: boolean;
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
  national_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  medical_conditions: string | null;
  [key: string]: any;
}

export interface RegistrationTripInfo {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  start_date: string;
  end_date: string;
  provider_id: string;
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
  participants: RegistrationParticipant[];
  trip: RegistrationTripInfo;
}

export interface ProviderProfile {
  id: string;
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_avatar_url: string | null;
  company_metadata: Record<string, any> | null;
  bio_en: string | null;
  bio_ar: string | null;
  total_trips: number;
  active_trips: number;
  average_rating: number;
  total_reviews: number;
}
