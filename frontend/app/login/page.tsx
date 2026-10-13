'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { ApiError, api, setToken } from '@/lib/api';
import type { AuthResponse } from '@/lib/types';

interface Credentials {
  email: string;
  password: string;
}

export default function LoginPage() {
  // useSearchParams opts the subtree out of static prerendering, so it needs a
  // Suspense boundary for the build to succeed.
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading…</main>}>
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No account?{' '}
        <Link href="/signup" className="underline">
          Create one
        </Link>
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {expired && (
          <p className="rounded-md border px-3 py-2 text-sm">
            Your session expired. Please sign in again.
          </p>
        )}

        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {error !== null && (
          <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}