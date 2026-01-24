export interface Provider {
  id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_avatar_url?: string | null;
  company_metadata: Record<string, any> | null;
}

export interface ProviderRegistrationPayload {
  company_name: string;
  company_email: string;
  company_phone: string;
}

export interface ProviderUpdatePayload {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_metadata?: Record<string, any>;
}
