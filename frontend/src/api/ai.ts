import { api } from './client';

export interface MatchResult {
  resource_name: string;
  resource_id?: number;
  match_score: number;
  reason: string;
}

export interface MatchResponse {
  enterprise_id: number;
  matches: {
    matches: MatchResult[];
    summary: string;
  };
}

export interface ProfileResponse {
  enterprise_id: number;
  profile: {
    summary: string;
    pain_points: Record<string, string[]>;
    investment_analysis: {
      rating: string;
      highlights: string[];
      risks: string[];
      estimated_investment: string;
      job_creation: string;
    };
  };
}

export interface ReportResponse {
  report_id: number;
  report: {
    title: string;
    sections: { heading: string; content: string }[];
    conclusion: string;
  };
}

export const aiApi = {
  generateProfile: (enterpriseId: number) =>
    api.post<ProfileResponse>(`/ai/generate-profile/${enterpriseId}`, {}),

  matchPolicies: (enterpriseId: number) =>
    api.post<MatchResponse>(`/ai/match-policies/${enterpriseId}`, {}),

  matchProperties: (enterpriseId: number) =>
    api.post<MatchResponse>(`/ai/match-properties/${enterpriseId}`, {}),

  generateReport: (enterpriseId: number) =>
    api.post<ReportResponse>(`/ai/generate-report/${enterpriseId}`, {}),
};
