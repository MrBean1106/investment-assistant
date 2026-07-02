import { useQuery } from '@tanstack/react-query';
import { policyApi, propertyApi, chainApi } from '../api/resources';

export function usePolicies(search?: string) {
  return useQuery({
    queryKey: ['policies', search],
    queryFn: () => policyApi.list(search),
  });
}

export function useProperties(search?: string) {
  return useQuery({
    queryKey: ['properties', search],
    queryFn: () => propertyApi.list(search),
  });
}

export function useIndustryChain() {
  return useQuery({
    queryKey: ['industryChain'],
    queryFn: () => chainApi.get(),
  });
}
