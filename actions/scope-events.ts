'use server';

import { getResend, FROM } from '@/lib/email/resend';
import { ApproachingScopeEmail, approachingScopeSubject } from '@/lib/email/templates/approaching-scope';
import { ScopeExceededEmail, scopeExceededSubject } from '@/lib/email/templates/scope-exceeded';
import { createClient } from '@/lib/supabase/server';
import type { MeterType, ScopeEventKind } from '@/lib/supabase/types';

interface SendScopeEmailParams {
  kind: ScopeEventKind;
  clientName: string;
  clientEmail: string;
  projectName: string;
  meterType: MeterType;
  meterType2: MeterType;
  used: number;
  budget: number;
  overageRateCents: number;
  agencyName: string;
  replyTo?: string;
  projectId: string;
}

export async function sendScopeEmail(params: SendScopeEmailParams): Promise<void> {
  const { kind, clientEmail, projectName, meterType, projectId, ...rest } = params;

  const subject =
    kind === 'approaching'
      ? approachingScopeSubject(projectName)
      : scopeExceededSubject(projectName);

  const react =
    kind === 'approaching'
      ? ApproachingScopeEmail({
          clientName: rest.clientName,
          projectName,
          meterType,
          used: rest.used,
          budget: rest.budget,
          overageRateCents: rest.overageRateCents,
          agencyName: rest.agencyName,
        })
      : ScopeExceededEmail({
          clientName: rest.clientName,
          projectName,
          meterType,
          budget: rest.budget,
          overageRateCents: rest.overageRateCents,
          agencyName: rest.agencyName,
        });

  await getResend().emails.send({
    from: FROM,
    to: clientEmail,
    replyTo: rest.replyTo,
    subject,
    react,
  });

  // Mark emailed_at on the event
  const supabase = await createClient();
  await supabase
    .from('scope_events')
    .update({ emailed_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('meter_type', meterType)
    .eq('kind', kind);
}
