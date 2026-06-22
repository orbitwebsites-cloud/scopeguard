import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Workspace } from '@/lib/supabase/types';

async function getWorkspace(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workspace_members')
    .select('workspaces(*)')
    .eq('user_id', userId)
    .single();
  return (data?.workspaces as unknown as Workspace) ?? null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const workspace = await getWorkspace(user.id);

  // First login — create workspace
  if (!workspace) {
    const { data: ws } = await supabase
      .from('workspaces')
      .insert({ owner_id: user.id, name: user.email?.split('@')[0] ?? 'My Agency' })
      .select()
      .single();
    if (ws) {
      await supabase.from('workspace_members').insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' });
    }
  }

  const planBadge = workspace?.plan === 'free'
    ? <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">Free</span>
    : <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full">{workspace?.plan === 'lifetime' ? 'Lifetime' : 'Pro'}</span>;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top nav */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/app" className="font-bold text-lg tracking-tight">ScopeGuard</Link>
          {workspace && (
            <span className="text-sm text-gray-400 hidden sm:block">
              {workspace.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {planBadge}
          <Link href="/app" className="text-sm text-gray-400 hover:text-white transition-colors">Projects</Link>
          <Link href="/app/settings" className="text-sm text-gray-400 hover:text-white transition-colors">Settings</Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-gray-500 hover:text-white transition-colors">Sign out</button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
