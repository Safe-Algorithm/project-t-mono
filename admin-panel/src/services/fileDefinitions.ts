import { api } from './api';

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
}

export interface FileDefinitionListResponse {
  items: FileDefinition[];
  total: number;
}

export const fileDefinitionsService = {
  // Get all file definitions (Admin only)
  async getAll(activeOnly: boolean = false): Promise<FileDefinitionListResponse> {
    const params = new URLSearchParams();
    params.append('skip', '0');
    params.append('limit', '100');
    params.append('active_only', activeOnly.toString());
    
    return api.get(`/admin/settings/file-definitions?${params.toString()}`);
  },

  // Get single file definition (Admin only)
  async getById(id: string): Promise<FileDefinition> {
    return api.get(`/admin/settings/file-definitions/${id}`);
  },

  // Create file definition (Admin only)
  async create(data: FileDefinitionCreate): Promise<FileDefinition> {
    return api.post('/admin/settings/file-definitions', data);
  },

  // Update file definition (Admin only)
  async update(id: string, data: FileDefinitionUpdate): Promise<FileDefinition> {
    return api.put(`/admin/settings/file-definitions/${id}`, data);
  },

  // Delete file definition (Admin only)
  async delete(id: string): Promise<void> {
    return api.del(`/admin/settings/file-definitions/${id}`);
  },

  // Get provider registration requirements (public endpoint)
  async getProviderRegistrationRequirements(): Promise<FileDefinition[]> {
    return api.get('/file-definitions/provider-registration');
  }
};
