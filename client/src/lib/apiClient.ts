export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  environment?: string;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code = 'API_ERROR', status = 500) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// In-Memory Token Storage (NEVER written to localStorage or sessionStorage)
let inMemoryAccessToken: string | null = null;

let onAuthFailureCallback: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null): void => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const setOnAuthFailure = (callback: () => void): void => {
  onAuthFailureCallback = callback;
};

/**
 * Executes a single-flight token refresh.
 * Multiple simultaneous 401 responses share this exact same Promise.
 */
export const performTokenRefresh = async (): Promise<string | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const url = `${BASE_URL}/auth/refresh`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Includes httpOnly refreshToken cookie
      });

      if (!res.ok) {
        throw new Error('Refresh failed');
      }

      const data = await res.json();
      const newToken = data?.data?.accessToken as string;

      if (!newToken) {
        throw new Error('No access token in response');
      }

      inMemoryAccessToken = newToken;
      return newToken;
    } catch {
      inMemoryAccessToken = null;
      if (onAuthFailureCallback) {
        onAuthFailureCallback();
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

async function executeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 with Single-Flight Refresh (avoiding refresh loops on login/refresh)
  const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');
  if (res.status === 401 && !isAuthEndpoint && !isRetry) {
    const newToken = await performTokenRefresh();
    if (newToken) {
      // Retry original request once with new token
      return executeRequest<T>(endpoint, options, true);
    }
  }

  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = res.statusText || 'Request failed';
    try {
      const errorData = (await res.json()) as ApiErrorResponse;
      if (errorData?.error?.message) {
        message = errorData.error.message;
        code = errorData.error.code || code;
      }
    } catch {
      // Non-JSON response fallback
    }
    throw new ApiClientError(message, code, res.status);
  }

  return (await res.json()) as T;
}

export const apiClient = {
  get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return executeRequest<T>(endpoint, { method: 'GET', ...options });
  },

  post<T, B = unknown>(endpoint: string, body?: B, options: RequestInit = {}): Promise<T> {
    return executeRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  },

  patch<T, B = unknown>(endpoint: string, body?: B, options: RequestInit = {}): Promise<T> {
    return executeRequest<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  },

  delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return executeRequest<T>(endpoint, { method: 'DELETE', ...options });
  },

  async upload<T>(endpoint: string, formData: FormData, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (inMemoryAccessToken) {
      headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'include',
      ...options,
    });

    if (!res.ok) {
      let message = 'Upload failed';
      try {
        const errData = (await res.json()) as ApiErrorResponse;
        message = errData?.error?.message || message;
      } catch {
        // Fallback
      }
      throw new ApiClientError(message, `HTTP_${res.status}`, res.status);
    }

    return (await res.json()) as T;
  },

  checkHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  },
};
