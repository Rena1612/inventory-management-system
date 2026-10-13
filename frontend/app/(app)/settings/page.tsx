'use client';

import { useCallback, useEffect, useState } from 'react';

import { api, describeError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Organization } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Table, TableNote, Td, Th } from '@/components/ui/DataTable';
import { ErrorNote, LoadingNote, PageError } from '@/components/ui/Notice';
import { Figure, FigureStrip, Panel } from '@/components/ui/Panel';
import { PageHeader, SectionHead } from '@/components/ui/PageHeader';

const MEMBER_COLUMNS = 3;

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
  const [membersError, setMembersError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    setMembersError(null);
    try {
      const [organization, usage] = await Promise.all([
        api<Organization>('/api/orgs/me'),
        api<Stats>('/api/orgs/stats'),
      ]);
      setOrg(organization);
      setStats(usage);
    } catch (caught) {
      setError(caught);
      return;
    }

    // Members load separately: a failure there must say "could not load",
    // not "no other members yet", which is a different fact.
    try {
      setMembers(await api<Member[]>('/api/orgs/members'));
    } catch (caught) {
      setMembersError(caught);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return (
      <PageError error={error} fallback="Settings could not be loaded." onRetry={load} />
    );
  }
  if (org === null || stats === null) return <LoadingNote />;

  const productLimit =
    stats.limits.products === null ? String(stats.usage.products) : `${stats.usage.products} / ${stats.limits.products}`;
  const locationLimit =
    stats.limits.locations === null ? String(stats.usage.locations) : `${stats.usage.locations} / ${stats.limits.locations}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <section className="space-y-3">
        <SectionHead>Organization</SectionHead>
        <Panel>
          <dl className="grid max-w-md grid-cols-3 gap-y-2 px-4 py-3 text-[13px]">
            <dt className="text-ink-2">Name</dt>
            <dd className="col-span-2">{org.name}</dd>
            <dt className="text-ink-2">Slug</dt>
            <dd className="ref col-span-2">{org.slug}</dd>
            <dt className="text-ink-2">Created</dt>
            <dd className="col-span-2">{formatDate(org.created_at)}</dd>
          </dl>
        </Panel>
      </section>

      <section className="space-y-3">
        <SectionHead aside={`Current plan: ${stats.plan}`}>Plan &amp; usage</SectionHead>
        <FigureStrip>
          <Figure label="Products" value={productLimit} />
          <Figure label="Locations" value={locationLimit} />
        </FigureStrip>
      </section>

      <section className="space-y-3">
        <SectionHead>
          Members
          <span className="ml-2 tabular-nums text-ink-3">{members.length}</span>
        </SectionHead>
        <Panel scroll>
          <Table className="max-w-2xl">
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Role</Th>
              </tr>
            </thead>
            <tbody>
              {membersError !== null ? (
                <tr>
                  <td colSpan={MEMBER_COLUMNS} className="td py-0">
                    <ErrorNote>
                      The member list could not be loaded: {describeError(membersError, 'Unknown error')}
                    </ErrorNote>
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id}>
                    <Td>{member.email}</Td>
                    <Td className="text-ink-2">{member.full_name ?? '—'}</Td>
                    <Td>{member.role}</Td>
                  </tr>
                ))
              )}
              {membersError === null && members.length === 0 && (
                <TableNote colSpan={MEMBER_COLUMNS}>No other members yet.</TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>

      <section className="space-y-3">
        <SectionHead>API access</SectionHead>
        <Panel>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Button disabled title="API keys are not available yet — the registration endpoint does not exist.">
              Generate key
            </Button>
            <p className="text-[13px] text-ink-2">
              API keys are not available yet. The server has no endpoint to register a
              key against, so anything generated here would not authenticate.
            </p>
          </div>
        </Panel>
      </section>
    </div>
  );
}