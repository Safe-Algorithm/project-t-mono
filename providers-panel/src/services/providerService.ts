import { Provider, ProviderUpdatePayload, ProviderRegistrationPayload } from '@/types/provider';
import { FullRegistrationPayload } from '@/types/user';
import { api } from './api';

const getProviderProfile = async (): Promise<Provider> => {
  // Assuming an endpoint like /providers/profile to get the current provider's profile
  const response = await api.get<Provider>('/providers/profile');
  return response;
};

const updateProviderProfile = async (payload: ProviderUpdatePayload): Promise<Provider> => {
  const response = await api.put<Provider>('/providers/profile', payload);
  return response;
};

const registerProvider = async (payload: FullRegistrationPayload): Promise<any> => {
  const response = await api.publicPost('/providers/register', payload);
  return response;
};

const login = async (credentials: { email: string; password: string }): Promise<{ access_token: string; token_type: string }> => {
  const formData = new URLSearchParams();
  formData.append('username', credentials.email);
  formData.append('password', credentials.password);
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/login/access-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Source': 'providers_panel',
    },
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  return response.json();
};

const getRequestStatus = async (): Promise<any> => {
  const response = await api.get('/providers/request-status');
  return response;
};

export const providerService = {
  getProviderProfile,
  updateProviderProfile,
  registerProvider,
  login,
  getRequestStatus,
};
