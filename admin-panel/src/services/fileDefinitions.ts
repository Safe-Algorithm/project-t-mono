import { api } from './api';

export interface FileGroupSummary {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
}

export interface ProviderFileGroup {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  file_definitions: FileDefinition[];
}

export interface ProviderFileGroupCreate {
  key: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  is_active: boolean;
  display_order: number;
}

export interface ProviderFileGroupUpdate {
  name_en?: string;
  name_ar?: string;
  description_en?: string;
  description_ar?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface ProviderFileGroupListResponse {
  items: ProviderFileGroup[];
  total: number;
}

export interface FileDefinition {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  allowed_extensions: string[];
  max_size_mb: number;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  file_group_id: string | null;
  file_group: FileGroupSummary | null;
  created_at: string;
  updated_at: string;
}

export interface FileDefinitionCreate {
  key: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  allowed_extensions: string[];
  max_size_mb: number;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  file_group_id?: string | null;
}

export interface FileDefinitionUpdate {
  name_en?: string;
  name_ar?: string;
  description_en?: string;
  description_ar?: string;
  allowed_extensions?: string[];
  max_size_mb?: number;
  is_required?: boolean;
  is_active?: boolean;
  display_order?: number;
  file_group_id?: string | null;
}

export interface FileDefinitionListResponse {
  items: FileDefinition[];
  total: number;
}

export const fileDefinitionsService = {
  // Get all file definitions (Admin only)
  async getAll(
    opts: { activeOnly?: boolean; skip?: number; limit?: number } | boolean = {}
  ): Promise<FileDefinitionListResponse> {
    // Support legacy boolean call signature
    const { activeOnly = false, skip = 0, limit = 100 } =
      typeof opts === 'boolean' ? { activeOnly: opts } : opts;
    const params = new URLSearchParams();
    params.append('skip', String(skip));
    params.append('limit', String(limit));
    params.append('active_only', String(activeOnly));
    return api.get(`/admin/settings/file-definitions?${params.toString()}`);
  },

  async getById(id: string): Promise<FileDefinition> {
    return api.get(`/admin/settings/file-definitions/${id}`);
  },

  async create(data: FileDefinitionCreate): Promise<FileDefinition> {
    return api.post('/admin/settings/file-definitions', data);
  },

  async update(id: string, data: FileDefinitionUpdate): Promise<FileDefinition> {
    return api.put(`/admin/settings/file-definitions/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return api.del(`/admin/settings/file-definitions/${id}`);
  },

  async getProviderRegistrationRequirements(): Promise<FileDefinition[]> {
    return api.get('/file-definitions/provider-registration');
  },
};

export const fileGroupsService = {
  async getAll(activeOnly: boolean = false): Promise<ProviderFileGroupListResponse> {
    const params = new URLSearchParams();
    params.append('skip', '0');
    params.append('limit', '100');
    params.append('active_only', activeOnly.toString());
    return api.get(`/admin/settings/file-groups?${params.toString()}`);
  },

  async getById(id: string): Promise<ProviderFileGroup> {
    return api.get(`/admin/settings/file-groups/${id}`);
  },

  async create(data: ProviderFileGroupCreate): Promise<ProviderFileGroup> {
    return api.post('/admin/settings/file-groups', data);
  },

  async update(id: string, data: ProviderFileGroupUpdate): Promise<ProviderFileGroup> {
    return api.put(`/admin/settings/file-groups/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return api.del(`/admin/settings/file-groups/${id}`);
  },
};
