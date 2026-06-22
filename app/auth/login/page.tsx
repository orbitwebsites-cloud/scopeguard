import { Suspense } from 'react';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
