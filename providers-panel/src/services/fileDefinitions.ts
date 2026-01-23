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

export interface FileDefinitionNested {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  accepted_file_extensions?: string[];
}

export interface ProviderFile {
  id: string;
  provider_id: string;
  file_definition_id: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  file_extension: string;
  content_type: string;
  file_hash?: string;
  file_verification_status: 'processing' | 'accepted' | 'rejected';
  rejection_reason?: string;
  reviewed_by_id?: string;
  reviewed_at?: string;
  uploaded_at: string;
  file_definition?: FileDefinitionNested;
}

export interface FileUploadResponse {
  file_id: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  message: string;
}

export const fileDefinitionsService = {
  // Get provider registration requirements (public endpoint - no auth needed)
  async getProviderRegistrationRequirements(): Promise<FileDefinition[]> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/file-definitions/provider-registration`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch file requirements');
    }
    return response.json();
  }
};

export const providerFilesService = {
  // Upload file for provider registration (initial upload)
  async uploadFile(fileDefinitionId: string, file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return api.postFormData(`/files/provider-registration/${fileDefinitionId}`, formData);
  },

  // Replace existing file (for profile page - synchronous upload)
  async replaceFile(fileDefinitionId: string, file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return api.putFormData(`/files/provider-registration/${fileDefinitionId}`, formData);
  },

  // Get all uploaded files for current provider
  async getUploadedFiles(): Promise<ProviderFile[]> {
    return api.get('/files/provider-registration');
  },

  // Get missing file definitions (active definitions not yet uploaded)
  async getMissingFileDefinitions(): Promise<FileDefinition[]> {
    return api.get('/files/provider-registration/missing-definitions');
  },

  // Delete uploaded file
  async deleteFile(fileId: string): Promise<void> {
    return api.del(`/files/provider-registration/${fileId}`);
  }
};
