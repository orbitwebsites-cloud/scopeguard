import * as React from 'react';
import type { MeterType } from '@/lib/supabase/types';
import { METER_LABELS } from '@/lib/domain';

interface Props {
  clientName: string;
  projectName: string;
  meterType: MeterType;
  budget: number;
  overageRateCents: number;
  agencyName: string;
}

export function ScopeExceededEmail({
  clientName,
  projectName,
  meterType,
  budget,
  overageRateCents,
  agencyName,
}: Props) {
  const label = METER_LABELS[meterType].toLowerCase();
  const rateFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(overageRateCents / 100);
  const unitLabel =
    meterType === 'hours' ? 'hour' : meterType === 'revisions' ? 'revision round' : 'deliverable';

  return (
    <div style={{ fontFamily: 'sans-serif', color: '#1a1a1a', maxWidth: 560, margin: '0 auto' }}>
      <p>Hi {clientName},</p>
      <p>
        We&apos;ve now used all <strong>{budget} {label}</strong> included in our agreement for{' '}
        <strong>{projectName}</strong>.
      </p>
      <p>
        We&apos;re happy to keep going — additional work is billed at{' '}
        <strong>{rateFormatted} per {unitLabel}</strong>. I&apos;ll send a short change order to
        confirm before we proceed.
      </p>
      <p>— {agencyName}</p>
    </div>
  );
}

export function scopeExceededSubject(projectName: string): string {
  return `${projectName} — we've reached the included scope`;
}
