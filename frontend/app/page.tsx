import Link from 'next/link';

import { Panel } from '@/components/ui/Panel';
import { SectionHead } from '@/components/ui/PageHeader';

const FEATURES = [
  {
    title: 'Append-only stock ledger',
    body: 'Every in, out, adjust and transfer is an immutable row. Stock levels are derived, never overwritten.',
  },
  {
    title: 'Multi-tenant by default',
    body: 'Every query is scoped to your organization. Your data stays invisible to other tenants.',
  },
  {
    title: 'Warehouse hierarchy',
    body: 'Model warehouses, zones, shelves and bins as a tree, and track stock at any level.',
  },
  {
    title: 'Live valuation',
    body: 'Cost and retail valuation by location, with suggested reorder quantities from supplier costs.',
  },
] as const;

const PLANS = [
  { name: 'Free', price: '$0', detail: '1 location, 100 products' },
  { name: 'Starter', price: '$10/mo', detail: '3 locations, 1,000 products' },
  { name: 'Pro', price: '$29/mo', detail: '10 locations, 10,000 products' },
  { name: 'Business', price: '$99/mo', detail: 'Unlimited, API access, multi-user' },
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="max-w-2xl">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
          Inventory Management System
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Multi-tenant stock tracking built on Postgres. An immutable movement ledger, warehouse
          hierarchies, purchase orders and valuation reporting.
        </p>
        <div className="mt-7 flex flex-wrap gap-2">
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
        </div>
      </section>

      <section className="mt-14 space-y-3">
        <SectionHead>What you get</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Panel key={feature.title} className="space-y-1.5 p-4">
              <h2 className="text-[13px] font-medium text-ink">{feature.title}</h2>
              <p className="text-[13px] leading-relaxed text-ink-2">{feature.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-14 space-y-3">
        <SectionHead>Pricing</SectionHead>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Panel key={plan.name} className="space-y-1.5 p-4">
              <h3 className="text-[13px] font-medium text-ink">{plan.name}</h3>
              <p className="text-xl font-medium tabular-nums text-ink">{plan.price}</p>
              <p className="text-[13px] text-ink-2">{plan.detail}</p>
            </Panel>
          ))}
        </div>
      </section>
    </main>
  );
}