const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1`;

const getAuthToken = (): string | null => {
  // Get the access token from localStorage
  return localStorage.getItem('admin_access_token');
};

// Global refresh token function that can be set by the auth context
let globalRefreshToken: (() => Promise<boolean>) | null = null;

export const setGlobalRefreshToken = (refreshFn: () => Promise<boolean>) => {
  globalRefreshToken = refreshFn;
};

export class ApiError extends Error {
  fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.fieldErrors = fieldErrors;
  }
}

const handleResponse = async (response: Response, retryCallback?: () => Promise<Response>): Promise<any> => {
  if (response.ok) {
    if (response.status === 204) {
      return null; // No Content
    }
    return response.json();
  }

  // Handle 401 Unauthorized - try to refresh token first
  if (response.status === 401 && globalRefreshToken && retryCallback) {
    try {
      const refreshSuccess = await globalRefreshToken();
      if (refreshSuccess) {
        // Retry the original request with new token
        const retryResponse = await retryCallback();
        return handleResponse(retryResponse); // Handle the retry response (without retry callback to avoid infinite loop)
      }
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
    }
    
    // If refresh failed or no refresh function available, redirect to login
    localStorage.removeItem('admin_access_token');
    window.location.href = '/login';
    throw new ApiError('Authentication failed');
  }

  const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred' }));

  if (response.status === 422 && errorData.detail && Array.isArray(errorData.detail)) {
    const fieldErrors = errorData.detail.reduce((acc: Record<string, string>, err: { loc: (string | number)[]; msg: string }) => {
      const field = err.loc[1]?.toString() || 'general';
      acc[field] = err.msg;
      return acc;
    }, {});
    throw new ApiError('Validation failed', fieldErrors);
  }

  throw new ApiError(errorData.detail || `API request failed with status ${response.status}`);
};

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const makeRequest = () => {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login';
        throw new ApiError('No authentication token');
      }
      
      return fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'admin_panel',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for refresh token
      });
    };

    const response = await makeRequest();
    return handleResponse(response, makeRequest);
  },

  async publicPost<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'admin_panel',
      },
      credentials: 'include', // Include cookies for refresh token
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    const makeRequest = () => {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login';
        throw new ApiError('No authentication token');
      }
      
      return fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'admin_panel',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for refresh token
        body: JSON.stringify(body),
      });
    };

    const response = await makeRequest();
    return handleResponse(response, makeRequest);
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    const makeRequest = () => {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login';
        throw new ApiError('No authentication token');
      }
      
      return fetch(`${BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'admin_panel',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for refresh token
        body: JSON.stringify(body),
      });
    };

    const response = await makeRequest();
    return handleResponse(response, makeRequest);
  },

  async patch<T>(endpoint: string, body: any): Promise<T> {
    const makeRequest = () => {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login';
        throw new ApiError('No authentication token');
      }
      
      return fetch(`${BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'admin_panel',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for refresh token
        body: JSON.stringify(body),
      });
    };

    const response = await makeRequest();
    return handleResponse(response, makeRequest);
  },

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const makeRequest = () => {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login';
        throw new ApiError('No authentication token');
      }
      
      return fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'X-Source': 'admin_panel',
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - browser will set it with boundary
        },
        credentials: 'include', // Include cookies for refresh token
        body: formData,
      });
    };

    const response = await makeRequest();
    return handleResponse(response, makeRequest);
  },

  async del<T>(endpoint: string): Promise<T> {
    const makeRequest = () => {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login';
        throw new ApiError('No authentication token');
      }
      
      return fetch(`${BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'X-Source': 'admin_panel',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for refresh token
      });
    };

    const response = await makeRequest();
    return handleResponse(response, makeRequest);
  },
};
