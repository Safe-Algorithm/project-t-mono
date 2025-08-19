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

export const providerService = {
  getProviderProfile,
  updateProviderProfile,
  registerProvider,
};
