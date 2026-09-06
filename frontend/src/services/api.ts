import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { TokenResponse, ApiResponse } from './apiTypes';

const API_BASE =
  `${import.meta.env.VITE_API_URL}/api/v1`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<TokenResponse> | null = null;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

export const getAccessToken = () => accessToken;

export const initTokens = () => {
  accessToken = localStorage.getItem('access_token');
  refreshToken = localStorage.getItem('refresh_token');
};

initTokens();

// Request interceptor
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = api.post<ApiResponse<TokenResponse>>('/auth/refresh', { refresh_token: refreshToken })
            .then(res => res.data.data!);
        }
        const tokens = await refreshPromise;
        setTokens(tokens.access_token, tokens.refresh_token);
        refreshPromise = null;

        originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
        return api(originalRequest);
      } catch {
        refreshPromise = null;
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (username_or_email: string, password: string) =>
    api.post<ApiResponse<TokenResponse>>('/auth/login', { username_or_email, password }),
  register: (data: { username: string; email: string; password: string; full_name: string; department?: string; phone?: string }) =>
    api.post<ApiResponse<any>>('/auth/register', data),
  refresh: (refresh_token: string) =>
    api.post<ApiResponse<TokenResponse>>('/auth/refresh', { refresh_token }),
  me: () => api.get<ApiResponse<any>>('/auth/me'),
  logout: () => api.post<ApiResponse<null>>('/auth/logout'),
  verify: () => api.get<ApiResponse<any>>('/auth/verify'),
};

// Users
export const usersApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; role?: string; is_active?: boolean }) =>
    api.get<ApiResponse<any>>('/users', { params }),
  create: (data: any) => api.post<ApiResponse<any>>('/users', data),
  get: (id: number) => api.get<ApiResponse<any>>(`/users/${id}`),
  update: (id: number, data: any) => api.patch<ApiResponse<any>>(`/users/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<null>>(`/users/${id}`),
  stats: () => api.get<ApiResponse<any>>('/users/stats/summary'),
};

// Scans
export const scansApi = {
  upload: (file: File, product_id?: number) => {
    const form = new FormData();
    form.append('file', file);
    if (product_id) form.append('product_id', String(product_id));
    return api.post<ApiResponse<any>>('/scans/upload', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  list: (params?: { page?: number; page_size?: number; status?: string; verdict?: string; product_id?: number; search?: string }) =>
    api.get<ApiResponse<any>>('/scans', { params }),
  get: (id: number) => api.get<ApiResponse<any>>(`/scans/${id}`),
  download: (id: number) => api.get(`/scans/${id}/download`, { responseType: 'blob' }),
  action: (id: number, action: 'retry' | 'reprocess') =>
    api.post<ApiResponse<any>>(`/scans/${id}/action`, { action }),
  delete: (id: number) => api.delete<ApiResponse<null>>(`/scans/${id}`),
  overview: () => api.get<ApiResponse<any>>('/scans/stats/overview'),
};

// Violations
export const violationsApi = {
  list: (scan_id: number, params?: { page?: number; page_size?: number; field_key?: string; status?: string }) =>
    api.get<ApiResponse<any>>('/violations', { params: { scan_id, ...params } }),
  summary: (scan_id: number) => api.get<ApiResponse<any>>(`/violations/scan/${scan_id}/summary`),
};

// Reports
export const reportsApi = {
  generate: (scan_id: number, remarks?: string) =>
    api.post<ApiResponse<any>>(`/reports/${scan_id}/generate`, { remarks }),
  list: (params?: { page?: number; page_size?: number; scan_id?: number }) =>
    api.get<ApiResponse<any>>('/reports', { params }),
  get: (id: number) => api.get<ApiResponse<any>>(`/reports/${id}`),
  download: (id: number) => api.get(`/reports/${id}/download`, { responseType: 'blob' }),
  delete: (id: number) => api.delete<ApiResponse<null>>(`/reports/${id}`),
};

// Dashboard
export const dashboardApi = {
  overview: (days?: number) => api.get<ApiResponse<any>>('/dashboard/overview', { params: { days } }),
};

// Products
export const productsApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; category?: string }) =>
    api.get<ApiResponse<any>>('/products', { params }),
  create: (data: any) => api.post<ApiResponse<any>>('/products', data),
  get: (id: number) => api.get<ApiResponse<any>>(`/products/${id}`),
  categories: () => api.get<ApiResponse<any>>('/products/stats/categories'),
};

// Audit Logs
export const auditApi = {
  list: (params?: { page?: number; page_size?: number; action?: string; user_id?: number; resource?: string; date_from?: string; date_to?: string }) =>
    api.get<ApiResponse<any>>('/audit-logs', { params }),
  get: (id: number) => api.get<ApiResponse<any>>(`/audit-logs/${id}`),
  stats: () => api.get<ApiResponse<any>>('/audit-logs/stats/summary'),
};

export default api;