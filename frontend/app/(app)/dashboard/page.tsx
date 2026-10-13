'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import {
  MOVEMENT_LABEL,
  formatDateTime,
  formatDelta,
  formatMoney,
  formatQuantity,
  movementDelta,
} from '@/lib/format';
import { StockGauge } from '@/components/StockGauge';

interface DashboardTotals {
  total_units: string;
  total_cost_value: string;
  total_retail_value: string;
  total_reserved: string;
  product_count: string;
}

interface RecentMovement {
  id: number;
  type: string;
  quantity: string;
  created_at: string;
  reference: string | null;
  product_sku: string;
  product_name: string;
  location_name: string;
}

interface Dashboard {
  totals: DashboardTotals;
  product_count: number;
  low_stock_count: number;
  recent_movements: RecentMovement[];
}

interface LowStockItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: string;
  reorder_point: string;
  reorder_qty: string;
  unit: string | null;
  supplier: string | null;
  suggested_order_cost: string | null;
}

interface LowStock {
  items: LowStockItem[];
  total: number;
  estimated_cost: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [low, setLow] = useState<LowStock | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Dashboard>('/api/reports/dashboard'), api<LowStock>('/api/reports/low-stock')])
      .then(([summary, shortfalls]) => {
        setData(summary);
        setLow(shortfalls);
      })
      .catch((caught: unknown) =>
        setError(caught instanceof ApiError ? caught.message : 'Failed to load dashboard'),
      );
  }, []);

  if (error !== null) {
    return <p className="text-[13px] text-destructive">{error}</p>;
  }
  if (data === null || low === null) {
    return <p className="text-[13px] text-ink-3">Loading…</p>;
  }

  const figures = [
    { label: 'Units on hand', value: formatQuantity(data.totals.total_units) },
    { label: 'Value at cost', value: formatMoney(data.totals.total_cost_value) },
    { label: 'Value at retail', value: formatMoney(data.totals.total_retail_value) },
    { label: 'Reserved', value: formatQuantity(data.totals.total_reserved) },
    { label: 'Products', value: String(data.product_count) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="page-head">Stock position</h1>

      <section className="panel flex flex-wrap divide-x divide-line">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-48 flex-1 px-4 py-3">
            <p className="text-[11px] text-ink-3">{figure.label}</p>
            <p className="num mt-0.5 text-[17px] font-medium text-ink">{figure.value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="section-head">
            Below reorder point
            <span className="ml-2 tabular-nums text-ink-3">{low.total}</span>
            {low.total > 0 && (
              <span className="ml-3 text-[12px] font-normal text-ink-3">
                {formatMoney(low.estimated_cost)} to replenish at cost
              </span>
            )}
          </h2>
        </div>

        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="th">SKU</th>
                <th className="th">Product</th>
                <th className="th">Supplier</th>
                <th className="th text-right">Reorder at</th>
                <th className="th text-right">Order qty</th>
                <th className="th w-40 pr-2 text-right">On hand</th>
              </tr>
            </thead>
            <tbody>
              {low.items.map((item) => (
                <tr key={item.product_id} className="print-keep">
                  <td className="td ref">
                    <Link href={`/products/${item.product_id}`} className="hover:text-accent">
                      {item.sku}
                    </Link>
                  </td>
                  <td className="td">{item.name}</td>
                  <td className="td text-ink-2">{item.supplier ?? '—'}</td>
                  <td className="td num text-ink-2">{formatQuantity(item.reorder_point)}</td>
                  <td className="td num text-ink-2">{formatQuantity(item.reorder_qty)}</td>
                  <td className="td pr-2">
                    <StockGauge
                      quantity={Number(item.quantity)}
                      reorderPoint={Number(item.reorder_point)}
                      reorderQty={Number(item.reorder_qty)}
                      label={formatQuantity(item.quantity)}
                      unit={item.unit ?? undefined}
                    />
                  </td>
                </tr>
              ))}
              {low.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="td py-6 text-center text-ink-3">
                    Every product is above its reorder point.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="section-head">Recent movements</h2>
          <Link href="/movements" className="text-[12px] text-accent hover:text-accent-deep">
            All movements
          </Link>
        </div>

        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="th">When</th>
                <th className="th">Product</th>
                <th className="th">Location</th>
                <th className="th">Type</th>
                <th className="th text-right">Change</th>
                <th className="th pr-2 text-right">Reference</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="td whitespace-nowrap text-ink-2">{formatDateTime(movement.created_at)}</td>
                  <td className="td">
                    <span className="ref">{movement.product_sku}</span>
                    <span className="ml-2">{movement.product_name}</span>
                  </td>
                  <td className="td text-ink-2">{movement.location_name}</td>
                  <td className="td text-ink-2">{MOVEMENT_LABEL[movement.type as keyof typeof MOVEMENT_LABEL] ?? movement.type}</td>
                  <td className="td num font-mono text-[12px]">
                    {formatDelta(movementDelta(movement.type, movement.quantity))}
                  </td>
                  <td className="td ref pr-2 text-right">{movement.reference ?? '—'}</td>
                </tr>
              ))}
              {data.recent_movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="td py-6 text-center text-ink-3">
                    No movements recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}