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
}
