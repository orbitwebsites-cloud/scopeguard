import * as React from 'react';
import type { MeterType } from '@/lib/supabase/types';
import { METER_LABELS } from '@/lib/domain';

interface Props {
  clientName: string;
  projectName: string;
  meterType: MeterType;
  used: number;
  budget: number;
  overageRateCents: number;
  agencyName: string;
}

export function ApproachingScopeEmail({
  clientName,
  projectName,
  meterType,
  used,
  budget,
  overageRateCents,
  agencyName,
}: Props) {
  const label = METER_LABELS[meterType].toLowerCase();
  const rateFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(overageRateCents / 100);

  return (
    <div style={{ fontFamily: 'sans-serif', color: '#1a1a1a', maxWidth: 560, margin: '0 auto' }}>
      <p>Hi {clientName},</p>
      <p>
        A quick note so there are no surprises: we&apos;re at <strong>{used} of {budget} {label}</strong> included
        in our agreement for <strong>{projectName}</strong>. We&apos;re not there yet — just flagging early.
      </p>
      <p>
        Anything beyond the included scope is billed at <strong>{rateFormatted}</strong> per additional{' '}
        {meterType === 'hours' ? 'hour' : meterType === 'revisions' ? 'revision round' : 'deliverable'},{' '}
        and we&apos;ll always confirm with you first.
      </p>
      <p>— {agencyName}</p>
    </div>
  );
}

export function approachingScopeSubject(projectName: string): string {
  return `Quick heads-up on the ${projectName} scope`;
}
