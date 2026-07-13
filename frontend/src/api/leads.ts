import { api } from './client';
import type { Lead, LeadListResponse, LeadStats } from '../types';

export const leadsApi = {
  list: (params?: { search?: string; stage?: string; owner?: string; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.stage) searchParams.set('stage', params.stage);
    if (params?.owner) searchParams.set('owner', params.owner);
    if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return api.get<LeadListResponse>(`/leads/${qs ? `?${qs}` : ''}`);
  },

  stats: () => api.get<LeadStats>('/leads/stats'),

  get: (id: number) => api.get<Lead>(`/leads/${id}`),

  create: (data: Partial<Lead>) => api.post<Lead>('/leads/', data),

  update: (id: number, data: Partial<Lead>) => api.put<Lead>(`/leads/${id}`, data),

  addFollowUp: (id: number, data: { content: string; owner?: string }) =>
    api.post<Lead>(`/leads/${id}/follow-up`, data),

  delete: (id: number) => api.del<void>(`/leads/${id}`),
};
