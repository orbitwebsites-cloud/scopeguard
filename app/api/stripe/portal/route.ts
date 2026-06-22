import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
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

  const ws = membership?.workspaces as unknown as { stripe_customer_id: string | null };
  if (!ws?.stripe_customer_id) return NextResponse.redirect(new URL('/app/settings', req.url));

  const session = await stripe.billingPortal.sessions.create({
    customer: ws.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings`,
  });

  return NextResponse.redirect(session.url);
}
