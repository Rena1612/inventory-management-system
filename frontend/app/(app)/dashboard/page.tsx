'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { MOVEMENT_LABEL, formatDateTime, formatDelta, formatMoney, formatQuantity } from '@/lib/format';
import type { MovementType } from '@/lib/types';
import { StockGauge } from '@/components/StockGauge';
import { Table, TableNote, Td, Th } from '@/components/ui/DataTable';
import { PageError } from '@/components/ui/Notice';
import { Figure, FigureStrip, Panel } from '@/components/ui/Panel';
import { PageHeader, SectionHead } from '@/components/ui/PageHeader';

interface DashboardTotals {
  total_units: string;
  total_cost_value: string;
  total_retail_value: string;
  total_reserved: string;
  product_count: string;
}

interface RecentMovement {
  id: number;
  type: MovementType;
  quantity: string;
  /** Signed effect on stock, computed server-side. Never re-derive it here. */
  delta: string;
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
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summary, shortfalls] = await Promise.all([
        api<Dashboard>('/api/reports/dashboard'),
        api<LowStock>('/api/reports/low-stock'),
      ]);
      setData(summary);
      setLow(shortfalls);
    } catch (caught) {
      setError(caught);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return (
      <PageError error={error} fallback="The dashboard could not be loaded." onRetry={load} />
    );
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
      <PageHeader title="Stock position" />

      <FigureStrip>
        {figures.map((figure) => (
          <Figure key={figure.label} label={figure.label} value={figure.value} />
        ))}
      </FigureStrip>

      <section className="space-y-2">
        <SectionHead
          aside={
            low.total > 0 ? `${formatMoney(low.estimated_cost)} to replenish at cost` : undefined
          }
        >
          Below reorder point
          <span className="ml-2 tabular-nums text-ink-3">{low.total}</span>
        </SectionHead>

        <Panel scroll>
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Product</Th>
                <Th>Supplier</Th>
                <Th align="right">Reorder at</Th>
                <Th align="right">Order qty</Th>
                <Th align="right" className="w-48 pr-2">
                  On hand
                </Th>
              </tr>
            </thead>
            <tbody>
              {low.items.map((item) => (
                <tr key={item.product_id} className="print-keep">
                  <Td className="ref">
                    <Link href={`/products/${item.product_id}`} className="hover:text-accent">
                      {item.sku}
                    </Link>
                  </Td>
                  <Td>{item.name}</Td>
                  <Td className="text-ink-2">{item.supplier ?? '—'}</Td>
                  <Td align="right" className="text-ink-2">
                    {formatQuantity(item.reorder_point)}
                  </Td>
                  <Td align="right" className="text-ink-2">
                    {formatQuantity(item.reorder_qty)}
                  </Td>
                  <Td className="pr-2">
                    <StockGauge
                      quantity={Number(item.quantity)}
                      reorderPoint={Number(item.reorder_point)}
                      reorderQty={Number(item.reorder_qty)}
                      label={formatQuantity(item.quantity)}
                      unit={item.unit ?? undefined}
                    />
                  </Td>
                </tr>
              ))}
              {low.items.length === 0 && (
                <TableNote colSpan={6}>
                  Every product is above its reorder point.
                </TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>

      <section className="space-y-2">
        <SectionHead aside={<Link href="/movements" className="text-accent hover:text-accent-deep">All movements</Link>}>
          Recent movements
        </SectionHead>

        <Panel scroll>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Product</Th>
                <Th>Location</Th>
                <Th>Type</Th>
                <Th align="right">Change</Th>
                <Th align="right" className="pr-2">
                  Reference
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.recent_movements.map((movement) => (
                <tr key={movement.id}>
                  <Td className="whitespace-nowrap text-ink-2">
                    {formatDateTime(movement.created_at)}
                  </Td>
                  <Td>
                    <span className="ref">{movement.product_sku}</span>
                    <span className="ml-2">{movement.product_name}</span>
                  </Td>
                  <Td className="text-ink-2">{movement.location_name}</Td>
                  <Td className="text-ink-2">{MOVEMENT_LABEL[movement.type]}</Td>
                  <Td align="right" className="font-mono text-[12px]">
                    {formatDelta(Number(movement.delta))}
                  </Td>
                  <Td align="right" className="ref pr-2">
                    {movement.reference ?? '—'}
                  </Td>
                </tr>
              ))}
              {data.recent_movements.length === 0 && (
                <TableNote colSpan={6}>
                  No movements recorded yet.
                </TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>
    </div>
  );
}