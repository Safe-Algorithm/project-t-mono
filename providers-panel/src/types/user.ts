export enum UserRole {
  NORMAL = 'normal',
  SUPER_USER = 'super_user',
}

import { ProviderRegistrationPayload } from './provider';

export interface UserRegistrationPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface FullRegistrationPayload {
  user: UserRegistrationPayload;
  provider: ProviderRegistrationPayload;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  company_name?: string;
  company_phone?: string;
  is_active: boolean;
  is_superuser: boolean;
  role: UserRole;
  provider_id: string | null;
}
