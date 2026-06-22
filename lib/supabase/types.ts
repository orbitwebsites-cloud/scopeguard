// Run `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts`
// after applying migrations to get the auto-generated types.
// The manual types below are sufficient until then.

export type MeterType = 'revisions' | 'hours' | 'deliverables';
export type ProjectStatus = 'active' | 'closed';
export type Plan = 'free' | 'pro' | 'lifetime';
export type ScopeEventKind = 'approaching' | 'over';
export type MeterLevel = 'healthy' | 'approaching' | 'over';

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  accent_color: string;
  reply_to_email: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  project_value_cents: number | null;
  threshold: number;
  status: ProjectStatus;
  created_at: string;
}

export interface Meter {
  id: string;
  project_id: string;
  type: MeterType;
  budget: number;
  overage_rate_cents: number;
}

export interface Entry {
  id: string;
  project_id: string;
  meter_type: MeterType;
  amount: number;
  note: string | null;
  created_by: string | null;
  occurred_at: string;
}

export interface ScopeEvent {
  id: string;
  project_id: string;
  meter_type: MeterType;
  kind: ScopeEventKind;
  emailed_at: string | null;
  created_at: string;
}

export interface ChangeOrder {
  id: string;
  project_id: string;
  line_items: LineItem[];
  note: string | null;
  total_cents: number;
  pdf_url: string | null;
  sent_to: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface LineItem {
  label: string;
  qty: number;
  unit_cents: number;
  total_cents: number;
}

// Placeholder to satisfy the generic until supabase gen types runs
export type Database = Record<string, unknown>;
