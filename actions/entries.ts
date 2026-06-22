'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { meterStatus } from '@/lib/domain';
import { sendScopeEmail } from './scope-events';
import type { MeterType, Meter } from '@/lib/supabase/types';

export async function logEntry(
  projectId: string,
  meterType: MeterType,
  amount: number,
  note: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.from('entries').insert({
    project_id: projectId,
    meter_type: meterType,
    amount,
    note: note || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  // Check thresholds inline (belt-and-suspenders alongside cron)
  await evaluateThresholds(projectId);

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath('/app');
  return {};
}

/** Core threshold logic — called both inline and by cron sweep. */
export async function evaluateThresholds(projectId: string): Promise<void> {
  const supabase = await createClient();

  // Load project + workspace
  const { data: project } = await supabase
    .from('projects')
    .select('*, workspace_id, threshold, client_name, client_email')
    .eq('id', projectId)
    .single();
  if (!project || project.status !== 'active') return;

  const { data: wsRow } = await supabase
    .from('workspaces')
    .select('name, reply_to_email, plan, accent_color')
    .eq('id', project.workspace_id)
    .single();
  if (!wsRow) return;

  const { data: meters } = await supabase.from('meters').select('*').eq('project_id', projectId);
  if (!meters?.length) return;

  // Sum entries per meter
  const { data: entrySums } = await supabase
    .from('entries')
    .select('meter_type, amount')
    .eq('project_id', projectId);

  const usageMap: Record<MeterType, number> = { revisions: 0, hours: 0, deliverables: 0 };
  for (const e of entrySums ?? []) usageMap[e.meter_type as MeterType] += Number(e.amount);

  // Existing events (idempotency check)
  const { data: existingEvents } = await supabase
    .from('scope_events')
    .select('meter_type, kind')
    .eq('project_id', projectId);

  const firedSet = new Set((existingEvents ?? []).map(e => `${e.meter_type}:${e.kind}`));

  for (const meter of meters as Meter[]) {
    const used = usageMap[meter.type] ?? 0;
    const s = meterStatus({ ...meter, used }, project.threshold);

    for (const kind of ['approaching', 'over'] as const) {
      if (s.level !== kind && !(kind === 'approaching' && s.level === 'over')) continue;
      if (kind === 'approaching' && s.level === 'over') continue; // only fire 'over' if over

      const key = `${meter.type}:${kind}`;
      if (firedSet.has(key)) continue; // already fired

      // Insert event (unique constraint prevents double-fire)
      const { error: evErr } = await supabase.from('scope_events').insert({
        project_id: projectId,
        meter_type: meter.type,
        kind,
      });
      if (evErr) continue; // unique constraint violation means already exists — skip

      // Send email for Pro workspaces only
      if ((wsRow.plan === 'pro' || wsRow.plan === 'lifetime') && project.client_email) {
        await sendScopeEmail({
          kind,
          clientName: project.client_name ?? 'there',
          clientEmail: project.client_email,
          projectName: project.name,
          meterType: meter.type,
          used,
          budget: meter.budget,
          overageRateCents: meter.overage_rate_cents,
          agencyName: wsRow.name,
          replyTo: wsRow.reply_to_email ?? undefined,
          projectId,
          meterType2: meter.type,
        });
      }

      firedSet.add(key);
    }
  }
}
