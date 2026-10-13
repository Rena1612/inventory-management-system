'use client';

import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import type { Organization } from '@/lib/types';

import { PrintButton } from '@/components/PrintButton';
import { Table, TableNote, Td, Th } from '@/components/ui/DataTable';
import { LoadingNote, PageError } from '@/components/ui/Notice';
import { Figure, FigureStrip, Panel } from '@/components/ui/Panel';
import { PageHeader, SectionHead } from '@/components/ui/PageHeader';

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

const LOCATION_COLUMNS = 5;
const LOW_STOCK_COLUMNS = 7;
const SUMMARY_COLUMNS = 4;

export default function ReportsPage() {
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [lowStock, setLowStock] = useState<LowStock | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
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
      setError(caught);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return <PageError error={error} fallback="The reports could not be loaded." onRetry={load} />;
  }
  if (valuation === null || lowStock === null) return <LoadingNote />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        className="print:hidden"
        actions={
          <PrintButton
            title="Inventory Report"
            generatedAt={generatedAt}
            organizationName={org?.name ?? null}
          />
        }
      />

      <section className="space-y-3">
        <SectionHead>Valuation</SectionHead>
        <FigureStrip>
          <Figure label="At cost" value={formatMoney(valuation.totals['total_cost_value'])} />
          <Figure label="At retail" value={formatMoney(valuation.totals['total_retail_value'])} />
          <Figure label="Units" value={formatQuantity(valuation.totals['total_units'])} />
        </FigureStrip>

        <Panel scroll>
          <Table>
            <thead>
              <tr>
                <Th>Location</Th>
                <Th>Type</Th>
                <Th align="right">Units</Th>
                <Th align="right">At cost</Th>
                <Th align="right">At retail</Th>
              </tr>
            </thead>
            <tbody>
              {valuation.by_location.map((row) => (
                <tr key={row.location_id} className="print-keep">
                  <Td>{row.location_name}</Td>
                  <Td className="text-ink-2">{row.location_type}</Td>
                  <Td align="right">{formatQuantity(row.total_units)}</Td>
                  <Td align="right">{formatMoney(row.total_cost_value)}</Td>
                  <Td align="right">{formatMoney(row.total_retail_value)}</Td>
                </tr>
              ))}
              {valuation.by_location.length === 0 && (
                <TableNote colSpan={LOCATION_COLUMNS}>
                  No locations to value yet.
                </TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>

      <section className="space-y-3">
        <SectionHead aside={`${lowStock.total} items · ${formatMoney(lowStock.estimated_cost)} to restock`}>
          Low stock
        </SectionHead>

        <Panel scroll>
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Name</Th>
                <Th align="right">On hand</Th>
                <Th align="right">Reorder at</Th>
                <Th align="right">Order</Th>
                <Th>Supplier</Th>
                <Th align="right">Est. cost</Th>
              </tr>
            </thead>
            <tbody>
              {lowStock.items.map((item) => (
                <tr key={item.product_id} className="print-keep">
                  <Td className="ref">{item.sku}</Td>
                  <Td>{item.name}</Td>
                  <Td align="right">{formatQuantity(item.quantity)}</Td>
                  <Td align="right">{formatQuantity(item.reorder_point)}</Td>
                  <Td align="right">{formatQuantity(item.suggested_order_qty)}</Td>
                  <Td className="text-ink-2">{item.supplier ?? '—'}</Td>
                  <Td align="right">{formatMoney(item.suggested_order_cost)}</Td>
                </tr>
              ))}
              {lowStock.items.length === 0 && (
                <TableNote colSpan={LOW_STOCK_COLUMNS}>
                  Everything is above its reorder point.
                </TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>

      <section className="space-y-3">
        <SectionHead>Movement summary</SectionHead>
        <Panel>
          <Table className="max-w-2xl">
            <thead>
              <tr>
                <Th>Type</Th>
                <Th align="right">Count</Th>
                <Th align="right">Quantity</Th>
                <Th align="right">Last activity</Th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.type} className="print-keep">
                  <Td>{row.type}</Td>
                  <Td align="right">{row.movement_count}</Td>
                  <Td align="right">{formatQuantity(row.total_quantity)}</Td>
                  <Td align="right" className="text-ink-2">
                    {formatDateTime(row.last_at)}
                  </Td>
                </tr>
              ))}
              {summary.length === 0 && (
                <TableNote colSpan={SUMMARY_COLUMNS}>No movements recorded.</TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>
    </div>
  );
}