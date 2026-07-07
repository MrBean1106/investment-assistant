import { api } from './client';
import type { Policy, Property, Chain, IndustryChainResponse } from '../types';

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
  // Chain list
  list: () => api.get<Chain[]>('/industry-chain/chains'),
  create: (data: { name: string; description?: string }) =>
    api.post<Chain>('/industry-chain/chains', data),
  update: (chainId: number, data: { name?: string; description?: string }) =>
    api.put<Chain>(`/industry-chain/chains/${chainId}`, data),
  delete: (chainId: number) => api.del<void>(`/industry-chain/chains/${chainId}`),

  // Full chain graph
  getFull: (chainId: number) => api.get<IndustryChainResponse>(`/industry-chain/chains/${chainId}/full`),

  // Nodes
  createNode: (chainId: number, data: { name: string; layer: string; description?: string }) =>
    api.post<{ id: number; name: string; layer: string; chain_id: number }>(`/industry-chain/chains/${chainId}/nodes`, data),
  updateNode: (chainId: number, nodeId: number, data: { name?: string; layer?: string; description?: string }) =>
    api.put<{ id: number }>(`/industry-chain/chains/${chainId}/nodes/${nodeId}`, data),
  deleteNode: (chainId: number, nodeId: number) =>
    api.del<void>(`/industry-chain/chains/${chainId}/nodes/${nodeId}`),

  // Edges
  createEdge: (chainId: number, data: { source_node_id: number; target_node_id: number }) =>
    api.post<{ id: number }>(`/industry-chain/chains/${chainId}/edges`, data),
  deleteEdge: (chainId: number, edgeId: number) =>
    api.del<void>(`/industry-chain/chains/${chainId}/edges/${edgeId}`),

  // Enterprise linking
  linkEnterprise: (chainId: number, nodeId: number, enterpriseId: number) =>
    api.post<{ status: string }>(`/industry-chain/chains/${chainId}/nodes/${nodeId}/enterprises`, { enterprise_id: enterpriseId }),
  unlinkEnterprise: (chainId: number, nodeId: number, enterpriseId: number) =>
    api.del<void>(`/industry-chain/chains/${chainId}/nodes/${nodeId}/enterprises/${enterpriseId}`),
};
