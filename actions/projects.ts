'use server';

import { createClient } from '@/lib/supabase/server';
import type { MeterType } from '@/lib/supabase/types';

interface CreateProjectInput {
  name: string;
  clientName: string;
  clientEmail: string;
  projectValueCents: number | null;
  threshold: number;
  meters: { type: MeterType; budget: number; overageRateCents: number }[];
}

export async function createProject(input: CreateProjectInput): Promise<{ projectId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Get workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(plan)')
    .eq('user_id', user.id)
    .single();
  if (!membership) return { error: 'No workspace found' };

  const ws = membership.workspaces as unknown as { plan: string };

  // Free plan: 1 active project limit
  if (ws.plan === 'free') {
    const { count } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', membership.workspace_id)
      .eq('status', 'active');
    if ((count ?? 0) >= 1) {
      return { error: 'Free plan is limited to 1 active project. Upgrade to Pro for unlimited projects.' };
    }
  }

  const { data: project, error: pErr } = await supabase
    .from('projects')
    .insert({
      workspace_id: membership.workspace_id,
      name: input.name,
      client_name: input.clientName || null,
      client_email: input.clientEmail || null,
      project_value_cents: input.projectValueCents,
      threshold: input.threshold,
    })
    .select()
    .single();

  if (pErr || !project) return { error: pErr?.message ?? 'Failed to create project' };

  const { error: mErr } = await supabase.from('meters').insert(
    input.meters.map(m => ({
      project_id: project.id,
      type: m.type,
      budget: m.budget,
      overage_rate_cents: m.overageRateCents,
    })),
  );

  if (mErr) return { error: mErr.message };

  return { projectId: project.id };
}

export async function closeProject(projectId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .update({ status: 'closed' })
    .eq('id', projectId);
  return { error: error?.message };
}
