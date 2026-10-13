import Link from 'next/link';

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
    <main className="mx-auto max-w-5xl px-6 py-20">
      <section className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Inventory Management System</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Multi-tenant stock tracking built on Postgres. An immutable movement ledger, warehouse
          hierarchies, purchase orders and valuation reporting.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-md border px-6 py-3 text-sm font-medium"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-8 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-lg border p-6">
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-24">
        <h2 className="text-center text-3xl font-bold">Pricing</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div key={plan.name} className="rounded-lg border p-6 text-center">
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold">{plan.price}</p>
              <p className="mt-2 text-sm text-muted-foreground">{plan.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}