const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1`;

const getAuthToken = (): string | null => {
  // Get the access token from localStorage
  return localStorage.getItem('provider_access_token');
};

export class ApiError extends Error {
  fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.fieldErrors = fieldErrors;
  }
}

const handleResponse = async (response: Response) => {
  if (response.ok) {
    if (response.status === 204) {
      return null; // No Content
    }
    return response.json();
  }

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    localStorage.removeItem('provider_access_token');
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
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      throw new ApiError('No authentication token');
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'providers_panel',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include', // Include cookies for refresh token
    });
    return handleResponse(response);
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
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      throw new ApiError('No authentication token');
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'providers_panel',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include', // Include cookies for refresh token
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      throw new ApiError('No authentication token');
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'providers_panel',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include', // Include cookies for refresh token
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async del<T>(endpoint: string): Promise<T> {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login';
      throw new ApiError('No authentication token');
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'X-Source': 'providers_panel',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include', // Include cookies for refresh token
    });
    return handleResponse(response);
  },
};
