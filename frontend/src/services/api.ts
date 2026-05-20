/**
 * API Service — Axios instance with JWT auth interceptors
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { TokenResponse, Asset, AssetListResponse, Assignment, Purchase, AssetHistory, AssetSummary } from '../types';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

// ─── Axios Instance ───────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ─── Request Interceptor (attach token) ──────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor (handle 401, refresh token) ────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await axios.post(`${BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          // Refresh failed — clear tokens and redirect to login
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string): Promise<TokenResponse> =>
    api.post('/auth/login', new URLSearchParams({ username: email, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    ).then(r => r.data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }).then(r => r.data),

  logout: () => api.post('/auth/logout').then(r => r.data),

  getMe: () => api.get('/users/me').then(r => r.data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then(r => r.data),

  resetPassword: (token: string, new_password: string) =>
    api.post('/auth/reset-password', { token, new_password }).then(r => r.data),
};

// ─── Assets ───────────────────────────────────────────────────
export const assetsApi = {
  list: (params?: Record<string, unknown>): Promise<AssetListResponse> =>
    api.get('/assets', { params }).then(r => r.data),

  get: (id: string): Promise<Asset> =>
    api.get(`/assets/${id}`).then(r => r.data),

  create: (data: Partial<Asset>): Promise<Asset> =>
    api.post('/assets', data).then(r => r.data),

  update: (id: string, data: Partial<Asset>): Promise<Asset> =>
    api.patch(`/assets/${id}`, data).then(r => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/assets/${id}`).then(r => r.data),

  bulkCreate: (data: Partial<Asset>[]): Promise<{ created: number; tags: string[]; errors: { row: number; error: string }[] }> =>
    api.post('/assets/bulk', data).then(r => r.data),

  exportAll: (params?: Record<string, unknown>): Promise<AssetListResponse> =>
    api.get('/assets', { params: { ...params, page: 1, page_size: 1000 } }).then(r => r.data),
};

// ─── Assignments ──────────────────────────────────────────────
export const assignmentsApi = {
  list: (params?: { asset_id?: string }): Promise<Assignment[]> =>
    api.get('/assignments', { params }).then(r => r.data),

  create: (data: {
    asset_id: string;
    user_id?: string;
    assignee_name?: string;
    assignee_email?: string;
    employee_id?: string;
    designation?: string;
    department?: string;
    assignment_date?: string;
    expected_return_date?: string;
    notes?: string;
  }): Promise<Assignment> =>
    api.post('/assignments', data).then(r => r.data),

  returnAsset: (assignmentId: string): Promise<void> =>
    api.post(`/assignments/${assignmentId}/return`).then(r => r.data),
};

// ─── Purchases ────────────────────────────────────────────────
export const purchasesApi = {
  list: (): Promise<Purchase[]> =>
    api.get('/purchases').then(r => r.data),

  create: (data: Partial<Purchase>): Promise<Purchase> =>
    api.post('/purchases', data).then(r => r.data),

  update: (id: string, data: Partial<Purchase>): Promise<Purchase> =>
    api.patch(`/purchases/${id}`, data).then(r => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/purchases/${id}`).then(r => r.data),

  uploadDocument: (purchaseId: string, file: File): Promise<{ key: string }> => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/purchases/${purchaseId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

// ─── History ──────────────────────────────────────────────────
export const historyApi = {
  getAssetHistory: (assetId: string): Promise<AssetHistory[]> =>
    api.get(`/history/${assetId}`).then(r => r.data),
};

// ─── Reports ──────────────────────────────────────────────────
export const reportsApi = {
  summary: (): Promise<AssetSummary> =>
    api.get('/reports/summary').then(r => r.data),

  assignedVsAvailable: () =>
    api.get('/reports/assigned-vs-available').then(r => r.data),

  byCategory: (): Promise<Record<string, Record<string, number>>> =>
    api.get('/reports/by-category').then(r => r.data),

  assets: (params: Record<string, unknown>) =>
    api.get('/reports/assets', { params }).then(r => r.data),
};

// ─── Notifications ────────────────────────────────────────────
export const notificationsApi = {
  warrantyExpiring: (days = 30) =>
    api.get('/notifications/warranty-expiring', { params: { days } }).then(r => r.data),

  softwareExpiring: (days = 30) =>
    api.get('/notifications/software-expiring', { params: { days } }).then(r => r.data),

  overdueAssignments: () =>
    api.get('/notifications/overdue-assignments').then(r => r.data),

  sendAlerts: (days = 30) =>
    api.post('/notifications/send-alerts', null, { params: { days } }).then(r => r.data),
};

// ─── Role Permissions ─────────────────────────────────────────
export const rolePermissionsApi = {
  get: (): Promise<Record<string, Record<string, boolean>>> =>
    api.get('/role-permissions').then(r => r.data),

  update: (data: Record<string, Record<string, boolean>>): Promise<void> =>
    api.put('/role-permissions', data).then(r => r.data),
};

// ─── Users ────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users').then(r => r.data),
  create: (data: Record<string, unknown>) =>
    api.post('/users', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/users/${id}`, data).then(r => r.data),
};

export default api;
