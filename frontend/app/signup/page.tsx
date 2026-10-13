'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ApiError, api, setToken } from '@/lib/api';
import type { AuthResponse } from '@/lib/types';

interface SignupForm {
  org_name: string;
  email: string;
  password: string;
  full_name: string;
}

const EMPTY: SignupForm = { org_name: '', email: '', password: '', full_name: '' };

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api<AuthResponse>('/api/auth/signup', {
        method: 'POST',
        body: { ...form, full_name: form.full_name || null },
        auth: false,
      });
      setToken(result.access_token);
      router.push('/dashboard');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create account');
    } finally {
      setPending(false);
    }
  }

  const fields = [
    { key: 'org_name', label: 'Organization name', type: 'text' },
    { key: 'full_name', label: 'Your name', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'password', label: 'Password', type: 'password' },
  ] as const;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">Create your organization</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Already registered?{' '}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
            </label>
            <input
              id={field.key}
              type={field.type}
              required={field.key !== 'full_name'}
              value={form[field.key]}
              onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Password must be at least 8 characters and contain letters and digits.
        </p>

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
          {pending ? 'Creating…' : 'Create organization'}
        </button>
      </form>
    </main>
  );
}