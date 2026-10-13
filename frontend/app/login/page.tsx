'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { ApiError, api, setToken } from '@/lib/api';
import type { AuthResponse } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';

interface Credentials {
  email: string;
  password: string;
}

export default function LoginPage() {
  // useSearchParams opts the subtree out of static prerendering, so it needs a
  // Suspense boundary for the build to succeed.
  return (
    <Suspense fallback={<main className="p-8 text-[13px] text-ink-3">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<Credentials>({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const expired = searchParams.get('expired') === '1';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: form,
        auth: false,
      });
      setToken(result.access_token);
      router.push('/dashboard');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to sign in');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Panel className="space-y-4 p-5">
        <div>
          <h1 className="text-[15px] font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            No account?{' '}
            <Link href="/signup" className="text-accent hover:text-accent-deep">
              Create one
            </Link>
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {expired && (
            <p className="border border-line bg-sunk px-3 py-2 text-[13px] text-ink-2">
              Your session expired. Please sign in again.
            </p>
          )}

          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="field"
            />
          </div>

          {error !== null && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Panel>
    </main>
  );
}