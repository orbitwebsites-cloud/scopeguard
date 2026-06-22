import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Redirect to the signed Supabase Storage URL for the PDF. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: co } = await supabase
    .from('change_orders')
    .select('pdf_url, project_id')
    .eq('id', id)
    .single();

  if (!co?.pdf_url) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.redirect(co.pdf_url);
}
