import type { Meter, MeterLevel, MeterType } from './supabase/types';

export interface MeterStatus {
  level: MeterLevel;
  ratio: number;
  used: number;
  budget: number;
  over: number;
}

export function meterStatus(
  meter: Pick<Meter, 'budget' | 'overage_rate_cents'> & { used: number },
  threshold = 0.8,
): MeterStatus {
  const ratio = meter.budget === 0 ? 0 : meter.used / meter.budget;
  const over = Math.max(0, meter.used - meter.budget);
  if (ratio >= 1) return { level: 'over', ratio, used: meter.used, budget: meter.budget, over };
  if (ratio >= threshold) return { level: 'approaching', ratio, used: meter.used, budget: meter.budget, over: 0 };
  return { level: 'healthy', ratio, used: meter.used, budget: meter.budget, over: 0 };
}

export function overageChargeCents(
  meter: Pick<Meter, 'budget' | 'overage_rate_cents'> & { used: number },
): number {
  const over = Math.max(0, meter.used - meter.budget);
  return Math.round(over * meter.overage_rate_cents);
}

const ORDER: Record<MeterLevel, number> = { healthy: 0, approaching: 1, over: 2 };

export function projectLevel(statuses: MeterStatus[]): MeterLevel {
  return statuses.reduce<MeterLevel>(
    (worst, s) => (ORDER[s.level] > ORDER[worst] ? s.level : worst),
    'healthy',
  );
}

export const METER_LABELS: Record<MeterType, string> = {
  revisions: 'Revision rounds',
  hours: 'Hours',
  deliverables: 'Deliverables',
};

export const METER_UNITS: Record<MeterType, string> = {
  revisions: 'round',
  hours: 'hr',
  deliverables: 'item',
};

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
