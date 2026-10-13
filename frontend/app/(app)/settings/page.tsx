'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import type { Organization } from '@/lib/types';

interface Stats {
  plan: string;
  usage: { products: number; locations: number };
  limits: { locations: number | null; products: number | null };
}

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

export default function SettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [organization, usage] = await Promise.all([
        api<Organization>('/api/orgs/me'),
        api<Stats>('/api/orgs/stats'),
      ]);
      setOrg(organization);
      setStats(usage);

      try {
        setMembers(await api<Member[]>('/api/orgs/members'));
      } catch {
        setMembers([]);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Failed to load settings');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function generateKey(): void {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    setApiKey(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));
  }

  if (error !== null) return <p className="text-sm text-destructive">{error}</p>;
  if (org === null || stats === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Organization</h2>
        <dl className="grid max-w-md grid-cols-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="col-span-2">{org.name}</dd>
          <dt className="text-muted-foreground">Slug</dt>
          <dd className="col-span-2 font-mono text-xs">{org.slug}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="col-span-2">{formatDate(org.created_at)}</dd>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Plan &amp; usage</h2>
        <p className="text-sm text-muted-foreground">Current plan: {stats.plan}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Products</p>
            <p className="mt-2 text-xl font-semibold">
              {stats.usage.products}
              <span className="text-sm font-normal text-muted-foreground">
                {stats.limits.products === null ? '' : ` / ${stats.limits.products}`}
              </span>
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Locations</p>
            <p className="mt-2 text-xl font-semibold">
              {stats.usage.locations}
              <span className="text-sm font-normal text-muted-foreground">
                {stats.limits.locations === null ? '' : ` / ${stats.limits.locations}`}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <table className="w-full max-w-2xl text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Email</th>
              <th className="py-2">Name</th>
              <th className="py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b">
                <td className="py-2">{member.email}</td>
                <td className="py-2 text-muted-foreground">{member.full_name ?? '—'}</td>
                <td className="py-2">{member.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">API access</h2>
        <p className="text-sm text-muted-foreground">
          API keys are available on the Business plan.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={generateKey}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Generate key
          </button>
          {apiKey !== null && (
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{apiKey}</code>
          )}
        </div>
      </section>
    </div>
  );
}