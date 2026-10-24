import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getSession, setSessionTokens, signOut } from '@/lib/auth/session-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Endpoints that must never trigger the silent token-refresh flow.
 *
 * A 401 on these routes means "wrong credentials", not "your access token
 * expired" — refreshing and redirecting would reload the page and hide the
 * error the user needs to see.
 */
const NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/accept-invite'];

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - attach token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getSession()?.accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle refresh + errors
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function isRefreshExempt(config: InternalAxiosRequestConfig): boolean {
  const url = config.url ?? '';
  return NO_REFRESH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshExempt(originalRequest)) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getSession()?.refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newToken = data.data.accessToken;
        // The backend rotates the refresh token, so the rotated one has to be
        // stored too — otherwise the next refresh is rejected.
        setSessionTokens(newToken, data.data.refreshToken);
        onTokenRefreshed(newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        signOut();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);