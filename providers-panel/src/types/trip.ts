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
  name: string;
  description: string;
  price: number;
  currency: string;
  is_active: boolean;
  required_fields: string[];
  required_fields_details?: TripPackageRequiredField[];
}

export interface Trip {
  id: string; // uuid
  name: string;
  description: string;
  start_date: string; // datetime
  end_date: string; // datetime
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
  currency: string;
}

export interface UpdateTripPackage {
  name?: string;
  description?: string;
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
