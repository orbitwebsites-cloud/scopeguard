import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { meterStatus } from '@/lib/domain';
import { resend, FROM } from '@/lib/email/resend';
import { ApproachingScopeEmail, approachingScopeSubject } from '@/lib/email/templates/approaching-scope';
import { ScopeExceededEmail, scopeExceededSubject } from '@/lib/email/templates/scope-exceeded';
import type { Meter, MeterType } from '@/lib/supabase/types';

export const runtime = 'nodejs';

/** Vercel Cron: runs daily. Auth via CRON_SECRET header. */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Load all active projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*, workspaces(name, reply_to_email, plan, accent_color)')
    .eq('status', 'active');

  if (!projects?.length) return NextResponse.json({ swept: 0 });

  let emailsSent = 0;
  let eventsFired = 0;

  for (const project of projects) {
    const ws = project.workspaces as unknown as {
      name: string; reply_to_email: string | null; plan: string; accent_color: string;
    };
    const isPro = ws.plan === 'pro' || ws.plan === 'lifetime';

    const { data: meters } = await supabase.from('meters').select('*').eq('project_id', project.id);
    if (!meters?.length) continue;

    const { data: entrySums } = await supabase
      .from('entries')
      .select('meter_type, amount')
      .eq('project_id', project.id);

    const usageMap: Record<MeterType, number> = { revisions: 0, hours: 0, deliverables: 0 };
    for (const e of entrySums ?? []) usageMap[e.meter_type as MeterType] += Number(e.amount);

    const { data: existingEvents } = await supabase
      .from('scope_events')
      .select('meter_type, kind')
      .eq('project_id', project.id);

    const firedSet = new Set((existingEvents ?? []).map((e: { meter_type: string; kind: string }) => `${e.meter_type}:${e.kind}`));

    for (const meter of meters as Meter[]) {
      const used = usageMap[meter.type] ?? 0;
      const s = meterStatus({ ...meter, used }, project.threshold);

      for (const kind of ['approaching', 'over'] as const) {
        if (kind === 'approaching' && s.level === 'over') continue;
        if (s.level !== kind) continue;

        const key = `${meter.type}:${kind}`;
        if (firedSet.has(key)) continue;

        const { error: evErr } = await supabase.from('scope_events').insert({
          project_id: project.id,
          meter_type: meter.type,
          kind,
        });
        if (evErr) continue; // unique constraint — already exists

        eventsFired++;

        if (isPro && project.client_email) {
          const emailProps = {
            clientName: project.client_name ?? 'there',
            projectName: project.name,
            meterType: meter.type as MeterType,
            used,
            budget: Number(meter.budget),
            overageRateCents: meter.overage_rate_cents,
            agencyName: ws.name,
          };

          await resend.emails.send({
            from: FROM,
            to: project.client_email,
            replyTo: ws.reply_to_email ?? undefined,
            subject: kind === 'approaching'
              ? approachingScopeSubject(project.name)
              : scopeExceededSubject(project.name),
            react: kind === 'approaching'
              ? ApproachingScopeEmail(emailProps)
              : ScopeExceededEmail({ ...emailProps, budget: Number(meter.budget) }),
          });

          await supabase.from('scope_events')
            .update({ emailed_at: new Date().toISOString() })
            .eq('project_id', project.id)
            .eq('meter_type', meter.type)
            .eq('kind', kind);

          emailsSent++;
        }

        firedSet.add(key);
      }
    }
  }

  return NextResponse.json({ swept: projects.length, eventsFired, emailsSent });
}
