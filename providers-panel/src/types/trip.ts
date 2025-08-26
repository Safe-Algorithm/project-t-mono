export interface TripPackage {
  id: string; // uuid
  trip_id: string; // uuid
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  required_fields: string[];
}

export interface Trip {
  id: string; // uuid
  name: string;
  description: string;
  start_date: string; // datetime
  end_date: string; // datetime
  price: number;
  max_participants: number;
  is_active: boolean;
  provider_id: string; // uuid
  trip_metadata?: Record<string, any>;
  packages: TripPackage[];
}

export interface CreateTripPackage {
  name: string;
  description: string;
  price: number;
}

export interface UpdateTripPackage {
  name?: string;
  description?: string;
  price?: number;
  is_active?: boolean;
}

export interface PackageRequiredField {
  field_type: string;
}

export interface FieldMetadata {
  field_name: string;
  display_name: string;
  ui_type: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}
