'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { renderChangeOrderPDF } from '@/lib/pdf/change-order';
import { getResend, FROM } from '@/lib/email/resend';
import type { LineItem } from '@/lib/supabase/types';

interface CreateChangeOrderInput {
  projectId: string;
  lineItems: LineItem[];
  note?: string;
}

export async function createChangeOrder(input: CreateChangeOrderInput): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Verify user has access to this project
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, workspace_id, client_name, client_email')
    .eq('id', input.projectId)
    .single();
  if (!project) return { error: 'Project not found' };

  // Check plan
  const { data: ws } = await supabase
    .from('workspaces')
    .select('name, reply_to_email, plan, accent_color, logo_url')
    .eq('id', project.workspace_id)
    .single();
  if (!ws) return { error: 'Workspace not found' };

  const totalCents = input.lineItems.reduce((s, l) => s + l.total_cents, 0);

  // Count existing change orders for this project (for numbering)
  const { count: coCount } = await supabase
    .from('change_orders')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', input.projectId);

  const orderNumber = (coCount ?? 0) + 1;

  // Generate PDF
  const isPro = ws.plan === 'pro' || ws.plan === 'lifetime';
  const pdfBuffer = await renderChangeOrderPDF({
    orderNumber,
    date: new Date().toLocaleDateString('en-US'),
    agencyName: ws.name,
    agencyEmail: ws.reply_to_email ?? '',
    logoUrl: isPro ? (ws.logo_url ?? undefined) : undefined,
    accentColor: isPro ? (ws.accent_color ?? undefined) : undefined,
    clientName: project.client_name ?? 'Client',
    projectName: project.name,
    lineItems: input.lineItems,
    totalCents,
    note: input.note,
  });

  // Upload to Supabase Storage
  const pdfPath = `${project.workspace_id}/${input.projectId}/${orderNumber}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('change-orders')
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) return { error: uploadErr.message };

  const { data: signedUrlData } = await supabase.storage
    .from('change-orders')
    .createSignedUrl(pdfPath, 60 * 60 * 24 * 30); // 30 days
  const signedUrl = signedUrlData?.signedUrl ?? null;

  const { data: co, error: coErr } = await supabase
    .from('change_orders')
    .insert({
      project_id: input.projectId,
      line_items: input.lineItems,
      note: input.note ?? null,
      total_cents: totalCents,
      pdf_url: signedUrl ?? null,
    })
    .select()
    .single();

  if (coErr || !co) return { error: coErr?.message ?? 'Failed to save change order' };

  revalidatePath(`/app/projects/${input.projectId}`);
  return { id: co.id };
}

export async function sendChangeOrder(changeOrderId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: co } = await supabase
    .from('change_orders')
    .select('*, projects(name, client_email, client_name, workspace_id)')
    .eq('id', changeOrderId)
    .single();

  if (!co) return { error: 'Change order not found' };
  if (co.sent_at) return { error: 'Already sent' };

  const project = co.projects as unknown as { name: string; client_email: string | null; client_name: string | null; workspace_id: string };
  if (!project.client_email) return { error: 'No client email on this project' };

  const { data: ws } = await supabase
    .from('workspaces')
    .select('name, reply_to_email')
    .eq('id', project.workspace_id)
    .single();

  const total = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(co.total_cents / 100);

  await getResend().emails.send({
    from: FROM,
    to: project.client_email,
    replyTo: ws?.reply_to_email ?? undefined,
    subject: `Change order for ${project.name} — ${total}`,
    html: `
      <p>Hi ${project.client_name ?? 'there'},</p>
      <p>Please find your change order for <strong>${project.name}</strong> — total <strong>${total}</strong>.</p>
      ${co.pdf_url ? `<p><a href="${co.pdf_url}">Download PDF</a></p>` : ''}
      ${co.note ? `<p>${co.note}</p>` : ''}
      <p>— ${ws?.name ?? 'Your agency'}</p>
    `,
  });

  await supabase
    .from('change_orders')
    .update({ sent_at: new Date().toISOString(), sent_to: project.client_email })
    .eq('id', changeOrderId);

  revalidatePath(`/app/projects/${(co.projects as unknown as { id: string }).id}`);
  return {};
}
