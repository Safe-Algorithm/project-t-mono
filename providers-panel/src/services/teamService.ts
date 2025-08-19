import { User } from '@/types/user';
import { api } from './api';

export interface TeamMemberInvitePayload {
  email: string;
  name: string;
  phone: string;
  password: string;
}

const inviteTeamMember = async (payload: TeamMemberInvitePayload): Promise<User> => {
  const response = await api.post<User>('/team/invite', payload);
  return response;
};

const getTeamMembers = async (): Promise<User[]> => {
  const response = await api.get<User[]>('/team/');
  return response;
};

const deleteTeamMember = async (userId: string): Promise<void> => {
  await api.del(`/team/${userId}`);
};

const updateTeamMemberRole = async (userId: string, role: string) => {
  const response = await api.put(`/team/${userId}/role`, { role });
  return response;
};

export const teamService = {
  inviteTeamMember,
  getTeamMembers,
  deleteTeamMember,
  updateTeamMemberRole,
};
