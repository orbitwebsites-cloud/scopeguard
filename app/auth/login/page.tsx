'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/app';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${next}` },
    });
    setSent(true);
    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=${next}` },
    });
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">ScopeGuard</h1>
          <p className="mt-1 text-gray-400 text-sm">Sign in to your agency dashboard</p>
        </div>

        {sent ? (
          <div className="rounded-xl bg-gray-800 border border-gray-700 p-6 text-center">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-sm text-gray-400">We sent a link to <span className="text-white">{email}</span></p>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-gray-900 font-semibold py-3 px-4 hover:bg-gray-100 transition-colors"
            >
              Continue with Google
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-700" />
              <span className="px-3 text-xs text-gray-500">or</span>
              <div className="flex-grow border-t border-gray-700" />
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@agency.com"
                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-semibold py-3 text-sm transition-colors"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
