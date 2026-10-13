'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ApiError, api, setToken } from '@/lib/api';
import type { AuthResponse } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';

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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Panel className="space-y-4 p-5">
        <div>
          <h1 className="text-[15px] font-semibold text-ink">Create your organization</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Already registered?{' '}
            <Link href="/login" className="text-accent hover:text-accent-deep">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="label">
                {field.label}
              </label>
              <input
                id={field.key}
                type={field.type}
                required={field.key !== 'full_name'}
                value={form[field.key]}
                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                className="field"
              />
            </div>
          ))}

          <p className="text-[11px] text-ink-3">
            Password must be at least 8 characters and contain letters and digits.
          </p>

          {error !== null && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? 'Creating…' : 'Create organization'}
          </Button>
        </form>
      </Panel>
    </main>
  );
}