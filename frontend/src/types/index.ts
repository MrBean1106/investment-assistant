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

export interface ChainNode {
  id: number;
  name: string;
  layer: string;
  description: string | null;
  enterprises: string[];
}

export interface ChainEdge {
  id: number;
  source_node_id: number;
  target_node_id: number;
}

export interface IndustryChainResponse {
  nodes: ChainNode[];
  edges: ChainEdge[];
}

export interface DashboardStats {
  totalEnterprises: number;
  negotiating: number;
  monthlySigned: number;
  totalMatches: number;
}
