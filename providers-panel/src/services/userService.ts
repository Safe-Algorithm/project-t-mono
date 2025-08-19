import { User } from '@/types/user';
import { api } from './api';

const getMe = async (): Promise<User> => {
  const response = await api.get<User>('/users/me');
  return response;
};

export const userService = {
  getMe,
};
