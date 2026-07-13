export interface Enterprise {
  id: number;
  name: string;
  industry: string;
  segment: string | null;
  region: string | null;
  scale: string | null;
  status: string;
  contact: string | null;
  demand: string | null;
  invest_rating: string | null;
  tags: string[];
  pain_points: Record<string, string[]> | null;
  needs: Record<string, unknown> | null;
  analysis_text: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EnterpriseListResponse {
  items: Enterprise[];
  total: number;
}

export interface Policy {
  id: number;
  title: string;
  level: string | null;
  category: string | null;
  scope: string | null;
  benefit: string | null;
  match_tags: string[];
}

export interface Property {
  id: number;
  name: string;
  type: string | null;
  area: string | null;
  floor: string | null;
  price: string | null;
  location: string | null;
  features: string | null;
  tags: string[];
}

// ── Industry Chain types ──

export interface Chain {
  id: number;
  name: string;
  description: string | null;
}

export interface LinkedEnterprise {
  id: number;
  name: string;
  industry: string | null;
  segment: string | null;
}

export interface ChainNode {
  id: number;
  chain_id: number;
  name: string;
  layer: string;
  description: string | null;
  enterprises: LinkedEnterprise[];
}

export interface ChainEdge {
  id: number;
  source_node_id: number;
  target_node_id: number;
}

export interface IndustryChainResponse {
  chain: Chain;
  nodes: ChainNode[];
  edges: ChainEdge[];
}

export interface DashboardStats {
  totalEnterprises: number;
  negotiating: number;
  monthlySigned: number;
  totalMatches: number;
}

// ── Stats API response (accurate aggregates) ──

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface RecentEnterprise {
  id: number;
  name: string;
  industry: string | null;
  status: string | null;
  invest_rating: string | null;
  region: string | null;
  updated_at: string | null;
}

export interface StatsResponse {
  total_enterprises: number;
  by_status: Record<string, number>;
  by_industry: Record<string, number>;
  by_region: Record<string, number>;
  by_rating: Record<string, number>;
  by_scale: Record<string, number>;
  funnel: FunnelStage[];
  conversion_rate: number;
  signed_or_landed: number;
  total_policies: number;
  total_properties: number;
  total_reports: number;
  recent_enterprises: RecentEnterprise[];
}

// ── Leads (招商线索) types ──

export interface FollowUp {
  date: string;
  content: string;
  owner: string;
}

export interface Lead {
  id: number;
  title: string | null;
  enterprise_id: number | null;
  company_name: string;
  source: string | null;
  stage: string;
  priority: string;
  owner: string | null;
  contact_name: string | null;
  contact_info: string | null;
  intent_investment: string | null;
  intent_region: string | null;
  expected_landing_date: string | null;
  progress: number;
  next_action: string | null;
  notes: string | null;
  follow_ups: FollowUp[];
  created_at: string | null;
  updated_at: string | null;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
}

export interface LeadStats {
  by_stage: Record<string, number>;
  total: number;
  active: number;
}
