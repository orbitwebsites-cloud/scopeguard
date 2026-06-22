'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function updateBranding(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single();
  if (!membership) return;

  await supabase.from('workspaces').update({
    name: formData.get('name') as string,
    reply_to_email: formData.get('replyToEmail') as string || null,
    accent_color: formData.get('accentColor') as string,
  }).eq('id', membership.workspace_id);

  revalidatePath('/app/settings');
}
