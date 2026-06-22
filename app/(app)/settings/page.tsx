import { createClient } from '@/lib/supabase/server';
import { updateBranding } from '@/actions/workspace';
import { redirect } from 'next/navigation';

async function getWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: m } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(*)')
    .eq('user_id', user.id)
    .single();
  return (m?.workspaces as unknown) as Record<string, unknown> | null;
}

export default async function SettingsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect('/auth/login');

  const PLAN_LABEL: Record<string, string> = {
    free: 'Free — 1 project, no auto-emails',
    pro: 'Pro — unlimited projects, auto-emails, branded PDFs',
    lifetime: 'Founding Lifetime — Pro forever',
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      {/* Plan */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Plan</h2>
        <p className="text-sm text-gray-300 mb-4">{PLAN_LABEL[ws.plan as string] ?? ws.plan}</p>
        {ws.plan === 'free' && (
          <a
            href={`/api/stripe/checkout?priceKey=pro_monthly`}
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Upgrade to Pro — $29/mo
          </a>
        )}
        {ws.plan !== 'free' && (
          <a
            href="/api/stripe/portal"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Manage billing →
          </a>
        )}
      </div>

      {/* Branding */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Agency branding</h2>
        <p className="text-xs text-gray-500 mb-4">Used on client emails and change-order PDFs.</p>
        <form action={updateBranding} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Agency name</label>
            <input name="name" defaultValue={ws.name as string}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Reply-to email</label>
            <input name="replyToEmail" type="email" defaultValue={(ws.reply_to_email as string) ?? ''}
              placeholder="hello@youragency.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Accent color</label>
            <div className="flex gap-2 items-center">
              <input name="accentColor" type="color" defaultValue={(ws.accent_color as string) ?? '#1864ab'}
                className="w-10 h-10 rounded border border-gray-700 bg-gray-800 cursor-pointer" />
              <span className="text-xs text-gray-500">Used in PDF header and email highlights</span>
            </div>
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Save branding
          </button>
        </form>
      </div>
    </div>
  );
}
