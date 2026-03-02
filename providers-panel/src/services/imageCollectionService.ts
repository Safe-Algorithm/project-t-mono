import { api } from './api';

export interface ProviderImage {
  id: string;
  provider_id: string;
  url: string;
  b2_file_id: string;
  b2_file_name: string;
  original_filename: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
}

export interface ProviderImageListResponse {
  items: ProviderImage[];
  total: number;
}

export const imageCollectionService = {
  getAll(skip = 0, limit = 100): Promise<ProviderImageListResponse> {
    return api.get(`/provider/images?skip=${skip}&limit=${limit}`);
  },

  delete(imageId: string): Promise<{ message: string }> {
    return api.del(`/provider/images/${imageId}`);
  },

  attachToTrip(tripId: string, imageId: string): Promise<{ message: string; url: string; total_images: number }> {
    return api.post(`/trips/${tripId}/images/from-collection?image_id=${imageId}`, {});
  },
};
