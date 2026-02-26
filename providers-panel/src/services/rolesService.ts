import { api } from './api';

export interface PermissionRule {
  id: string;
  http_method: string;
  path_pattern: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  source: 'provider' | 'admin';
  group_name: string;
  is_active: boolean;
  rules: PermissionRule[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  source: 'provider' | 'admin';
  provider_id: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface UserRoleLink {
  user_id: string;
  role_id: string;
  assigned_at: string;
}

const listPermissions = async (): Promise<Permission[]> => {
  return api.get<Permission[]>('/provider/roles/permissions');
};

const listRoles = async (): Promise<RoleWithPermissions[]> => {
  return api.get<RoleWithPermissions[]>('/provider/roles');
};

const createRole = async (name: string, description?: string): Promise<Role> => {
  return api.post<Role>('/provider/roles', { name, description });
};

const getRole = async (roleId: string): Promise<RoleWithPermissions> => {
  return api.get<RoleWithPermissions>(`/provider/roles/${roleId}`);
};

const updateRole = async (roleId: string, data: { name?: string; description?: string; is_active?: boolean }): Promise<Role> => {
  return api.patch<Role>(`/provider/roles/${roleId}`, data);
};

const deleteRole = async (roleId: string): Promise<void> => {
  await api.del(`/provider/roles/${roleId}`);
};

const addPermissions = async (roleId: string, permissionIds: string[]): Promise<void> => {
  await api.post(`/provider/roles/${roleId}/permissions`, { permission_ids: permissionIds });
};

const removePermission = async (roleId: string, permissionId: string): Promise<void> => {
  await api.del(`/provider/roles/${roleId}/permissions/${permissionId}`);
};

const listRoleUsers = async (roleId: string): Promise<UserRoleLink[]> => {
  return api.get<UserRoleLink[]>(`/provider/roles/${roleId}/users`);
};

const assignUsersToRole = async (roleId: string, userIds: string[]): Promise<void> => {
  await api.post(`/provider/roles/${roleId}/users`, { role_ids: userIds });
};

const removeUserFromRole = async (roleId: string, userId: string): Promise<void> => {
  await api.del(`/provider/roles/${roleId}/users/${userId}`);
};

const getUserRoles = async (userId: string): Promise<Role[]> => {
  return api.get<Role[]>(`/provider/roles/users/${userId}/roles`);
};

export const rolesService = {
  listPermissions,
  listRoles,
  createRole,
  getRole,
  updateRole,
  deleteRole,
  addPermissions,
  removePermission,
  listRoleUsers,
  assignUsersToRole,
  removeUserFromRole,
  getUserRoles,
};
