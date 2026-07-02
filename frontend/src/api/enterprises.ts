import { api } from './client';
import type { Enterprise, EnterpriseListResponse } from '../types';

export const enterpriseApi = {
  list: (params?: { search?: string; status?: string; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return api.get<EnterpriseListResponse>(`/enterprises/${qs ? `?${qs}` : ''}`);
  },

  get: (id: number) => api.get<Enterprise>(`/enterprises/${id}`),

  create: (data: Partial<Enterprise>) => api.post<Enterprise>('/enterprises/', data),

  update: (id: number, data: Partial<Enterprise>) => api.put<Enterprise>(`/enterprises/${id}`, data),

  delete: (id: number) => api.del<void>(`/enterprises/${id}`),
};
