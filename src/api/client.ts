import { create, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/**
 * EasyShoppingMallBD Axios API Client Configuration
 * Base URL is read dynamically from Expo public environment variable,
 * falling back to a safe placeholder endpoint.
 */
const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://api.easyshoppingmallbd.com';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export const apiClient: AxiosInstance = create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: defaultHeaders,
});

// Request interceptor: attach auth tokens or global telemetry if needed
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Token is attached dynamically via authSlice when sign-in / hydrate runs:
    //   apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // No additional work needed here.
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle unified API response / error transformation
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 Unauthorized, the auth slice will handle clearing the session
    // Pass errors down cleanly to React Query / callers
    return Promise.reject(error);
  }
);

export default apiClient;
