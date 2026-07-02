import { api } from './client';
import type { Policy, Property, IndustryChainResponse } from '../types';

export const policyApi = {
  list: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.get<Policy[]>(`/policies/${qs}`);
  },
  create: (data: Partial<Policy>) => api.post<Policy>('/policies/', data),
  delete: (id: number) => api.del<void>(`/policies/${id}`),
};

export const propertyApi = {
  list: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.get<Property[]>(`/properties/${qs}`);
  },
  create: (data: Partial<Property>) => api.post<Property>('/properties/', data),
  delete: (id: number) => api.del<void>(`/properties/${id}`),
};

export const chainApi = {
  get: () => api.get<IndustryChainResponse>('/industry-chain/'),
};
