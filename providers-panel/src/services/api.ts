const API_BASE_URL = 'http://localhost:8000';

const getAuthToken = (): string | null => {
  // In a real app, you'd get this from a more secure location
  return localStorage.getItem('provider_token');
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
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    return handleResponse(response);
  },

  async publicPost<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async del<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    return handleResponse(response);
  },
};
