import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../api/ai';

export function useGenerateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enterpriseId: number) => aiApi.generateProfile(enterpriseId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['enterprise', data.enterprise_id] });
    },
  });
}

export function useMatchPolicies() {
  return useMutation({
    mutationFn: (enterpriseId: number) => aiApi.matchPolicies(enterpriseId),
  });
}

export function useMatchProperties() {
  return useMutation({
    mutationFn: (enterpriseId: number) => aiApi.matchProperties(enterpriseId),
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: (enterpriseId: number) => aiApi.generateReport(enterpriseId),
  });
}
