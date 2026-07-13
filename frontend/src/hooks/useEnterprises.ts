import { useQuery } from '@tanstack/react-query';
import { enterpriseApi } from '../api/enterprises';

export function useEnterprises(params?: { search?: string; status?: string }) {
  return useQuery({
    queryKey: ['enterprises', params],
    queryFn: () => enterpriseApi.list(params),
  });
}

export function useEnterprise(id: number) {
  return useQuery({
    queryKey: ['enterprise', id],
    queryFn: () => enterpriseApi.get(id),
    enabled: !!id,
  });
}
