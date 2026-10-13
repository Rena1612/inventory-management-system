'use client';

import { useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import type { Organization } from '@/lib/types';

import { PrintButton } from '@/components/PrintButton';

interface Valuation {
  totals: Record<string, string>;
  by_location: Array<{
    location_id: string;
    location_name: string;
    location_type: string;
    total_units: string;
    total_cost_value: string;
    total_retail_value: string;
  }>;
}

interface LowStockItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: string;
  reorder_point: string;
  reorder_qty: string;
  unit: string;
  supplier: string | null;
  suggested_order_qty: string;
  suggested_order_cost: string;
}

interface LowStock {
  items: LowStockItem[];
  total: number;
  estimated_cost: string;
}

interface SummaryRow {
  type: string;
  movement_count: string;
  total_quantity: string;
  first_at: string | null;
  last_at: string | null;
}

export default function ReportsPage() {
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [lowStock, setLowStock] = useState<LowStock | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [v, l, s, organization] = await Promise.all([
          api<Valuation>('/api/reports/valuation'),
          api<LowStock>('/api/reports/low-stock'),
          api<{ items: SummaryRow[] }>('/api/reports/movement-summary'),
          api<Organization>('/api/orgs/me').catch(() => null),
        ]);
        setValuation(v);
        setLowStock(l);
        setSummary(s.items);
        setOrg(organization);
        setGeneratedAt(new Date().toISOString());
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Failed to load reports');
      }
    })();
  }, []);

  if (error !== null) return <p className="text-sm text-destructive">{error}</p>;
  if (valuation === null || lowStock === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold print:hidden">Reports</h1>
        <PrintButton
          title="Inventory Report"
          generatedAt={generatedAt}
          organizationName={org?.name ?? null}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Valuation</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">At cost</p>
            <p className="mt-2 text-xl font-semibold">
              {formatMoney(valuation.totals['total_cost_value'])}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">At retail</p>
            <p className="mt-2 text-xl font-semibold">
              {formatMoney(valuation.totals['total_retail_value'])}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Units</p>
            <p className="mt-2 text-xl font-semibold">
              {formatQuantity(valuation.totals['total_units'])}
            </p>
          </div>
        </div>

        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Location</th>
              <th className="py-2">Type</th>
              <th className="py-2 text-right">Units</th>
              <th className="py-2 text-right">At cost</th>
              <th className="py-2 text-right">At retail</th>
            </tr>
          </thead>
          <tbody>
            {valuation.by_location.map((row) => (
              <tr key={row.location_id} className="border-b">
                <td className="py-2">{row.location_name}</td>
                <td className="py-2">{row.location_type}</td>
                <td className="py-2 text-right">{formatQuantity(row.total_units)}</td>
                <td className="py-2 text-right">{formatMoney(row.total_cost_value)}</td>
                <td className="py-2 text-right">{formatMoney(row.total_retail_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Low stock</h2>
          <span className="text-sm text-muted-foreground">
            {lowStock.total} items · {formatMoney(lowStock.estimated_cost)} to restock
          </span>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">SKU</th>
              <th className="py-2">Name</th>
              <th className="py-2 text-right">On hand</th>
              <th className="py-2 text-right">Reorder at</th>
              <th className="py-2 text-right">Order</th>
              <th className="py-2">Supplier</th>
              <th className="py-2 text-right">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {lowStock.items.map((item) => (
              <tr key={item.product_id} className="border-b">
                <td className="py-2 font-mono text-xs">{item.sku}</td>
                <td className="py-2">{item.name}</td>
                <td className="py-2 text-right">{formatQuantity(item.quantity)}</td>
                <td className="py-2 text-right">{formatQuantity(item.reorder_point)}</td>
                <td className="py-2 text-right">{formatQuantity(item.suggested_order_qty)}</td>
                <td className="py-2 text-muted-foreground">{item.supplier ?? '—'}</td>
                <td className="py-2 text-right">{formatMoney(item.suggested_order_cost)}</td>
              </tr>
            ))}
            {lowStock.items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                  Everything is above its reorder point.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Movement summary</h2>
        <table className="w-full max-w-2xl text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Type</th>
              <th className="py-2 text-right">Count</th>
              <th className="py-2 text-right">Quantity</th>
              <th className="py-2 text-right">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr key={row.type} className="border-b">
                <td className="py-2">{row.type}</td>
                <td className="py-2 text-right">{row.movement_count}</td>
                <td className="py-2 text-right">{formatQuantity(row.total_quantity)}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {formatDateTime(row.last_at)}
                </td>
              </tr>
            ))}
            {summary.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted-foreground">
                  No movements recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}