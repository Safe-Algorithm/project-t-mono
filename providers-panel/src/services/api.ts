const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1`;

const getAuthToken = (): string | null => {
  // Get the access token from localStorage
  return localStorage.getItem('provider_access_token');
};

// Global refresh token function that can be set by the auth context
let globalRefreshToken: (() => Promise<boolean>) | null = null;
let refreshInProgress: Promise<boolean> | null = null;

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

export class PermissionDeniedError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Extracts a user-friendly error string from any thrown value.
 * For ApiErrors with fieldErrors (422 pydantic validation), the individual
 * field messages are joined so the user sees what actually went wrong.
 */
export function extractErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (err instanceof ApiError) {
    if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
      const lines = Object.entries(err.fieldErrors).map(
        ([field, msg]) => `• ${field.replace(/_/g, ' ')}: ${msg}`
      );
      return lines.join('\n');
    }
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
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
      // If a refresh is already in progress, wait for it instead of starting a new one
      if (!refreshInProgress) {
        refreshInProgress = globalRefreshToken();
      }
      
      const refreshSuccess = await refreshInProgress;
      refreshInProgress = null; // Clear the flag after completion
      
      if (refreshSuccess) {
        // Retry the original request with new token
        const retryResponse = await retryCallback();
        return handleResponse(retryResponse); // Handle the retry response (without retry callback to avoid infinite loop)
      }
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      refreshInProgress = null; // Clear the flag on error
    }
    
    // If refresh failed or no refresh function available, redirect to login
    localStorage.removeItem('provider_access_token');
    window.location.href = '/login';
    throw new ApiError('Authentication failed');
  }

  const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred' }));

  if (response.status === 403) {
    throw new PermissionDeniedError(errorData.detail || 'You do not have permission to perform this action.');
  }

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
          'X-Source': 'providers_panel',
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
        'X-Source': 'providers_panel',
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
          'X-Source': 'providers_panel',
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
          'X-Source': 'providers_panel',
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
          'X-Source': 'providers_panel',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for refresh token
        body: JSON.stringify(body),
      });
    };

    const response = await makeRequest();
    return handleResponse(response, makeRequest);
  },

  async putFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const makeRequest = () => {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login';
        throw new ApiError('No authentication token');
      }
      
      return fetch(`${BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
          'X-Source': 'providers_panel',
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
          'X-Source': 'providers_panel',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for refresh token
        body: JSON.stringify(body),
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
          'X-Source': 'providers_panel',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for refresh token
      });
    };

    const response = await makeRequest();
    return handleResponse(response, makeRequest);
  },
};
