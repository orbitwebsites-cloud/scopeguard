import { NextRequest, NextResponse } from 'next/server';
import { stripe, planFromPrice } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const workspaceId = session.metadata?.workspaceId;
    if (!workspaceId) return NextResponse.json({ ok: true });

    const priceId = (session as unknown as { line_items?: { data?: { price?: { id?: string } }[] } })?.line_items?.data?.[0]?.price?.id
      ?? session.metadata?.priceId;

    const plan = priceId ? planFromPrice(priceId) : 'pro';

    await supabase.from('workspaces').update({
      plan,
      stripe_customer_id: session.customer as string,
    }).eq('id', workspaceId);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    await supabase.from('workspaces')
      .update({ plan: 'free' })
      .eq('stripe_customer_id', sub.customer as string);
  }

  return NextResponse.json({ ok: true });
}
