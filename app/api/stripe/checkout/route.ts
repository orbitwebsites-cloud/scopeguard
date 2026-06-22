import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICES } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', req.url));

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(stripe_customer_id)')
    .eq('user_id', user.id)
    .single();
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 400 });

  const priceKey = req.nextUrl.searchParams.get('priceKey') ?? 'pro_monthly';
  const priceId = STRIPE_PRICES[priceKey];
  if (!priceId) return NextResponse.json({ error: 'Invalid price' }, { status: 400 });

  const ws = membership.workspaces as unknown as { stripe_customer_id: string | null };

  const session = await stripe.checkout.sessions.create({
    mode: priceKey === 'lifetime' ? 'payment' : 'subscription',
    customer: ws.stripe_customer_id ?? undefined,
    customer_email: ws.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings`,
    metadata: { workspaceId: membership.workspace_id, priceId },
  });

  return NextResponse.redirect(session.url!);
}
