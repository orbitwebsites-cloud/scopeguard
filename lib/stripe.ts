import Stripe from 'stripe';
import type { Plan } from './supabase/types';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export const STRIPE_PRICES: Record<string, string> = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL!,
  lifetime: process.env.STRIPE_PRICE_LIFETIME!,
};

/** Map a Stripe price ID to our internal plan. */
export function planFromPrice(priceId: string): Plan {
  if (priceId === STRIPE_PRICES.lifetime) return 'lifetime';
  if (priceId === STRIPE_PRICES.pro_monthly || priceId === STRIPE_PRICES.pro_annual) return 'pro';
  return 'free';
}

export function isPro(plan: Plan): boolean {
  return plan === 'pro' || plan === 'lifetime';
}
