'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Page, PurchaseOrder } from '@/lib/types';
import { StatusBadge } from '@/components/purchase-orders/StatusBadge';
import { PurchaseOrderForm } from '@/components/purchase-orders/PurchaseOrderForm';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Table, TableNote, TablePending, Td, Th } from '@/components/ui/DataTable';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/ui/PageHeader';

const STATUSES = ['draft', 'open', 'partial', 'received', 'cancelled'] as const;

const COLUMNS = 6;

export default function PurchaseOrdersPage() {
  const toast = useToast();
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Page<PurchaseOrder>>('/api/purchase-orders', {
        query: { status: status || undefined, limit: 50 },
      });
      setItems(result.items);
      setTotal(result.meta.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(order: PurchaseOrder) {
    const label = order.reference ?? order.id.slice(0, 8);
    if (!window.confirm(`Archive purchase order ${label}?`)) return;
    try {
      await api(`/api/purchase-orders/${order.id}`, { method: 'DELETE' });
      toast.push(`Archived ${label}`);
      void load();
    } catch (caught) {
      toast.push(
        caught instanceof ApiError ? caught.message : 'Could not archive the purchase order',
        'error',
      );
    }
  }

  return (
    <div className="space-y-6">
      <PurchaseOrderForm />

      <PageHeader title="Purchase Orders" count={total} />

      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        aria-label="Filter by status"
        className="field w-48"
      >
        <option value="">All statuses</option>
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Panel scroll>
        <Table>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Supplier</Th>
              <Th>Status</Th>
              <Th align="right">Items</Th>
              <Th align="right">Total</Th>
              <Th align="right" className="pr-2">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((order) => (
              <tr key={order.id}>
                <Td>
                  <a
                    href={`/purchase-orders/${order.id}`}
                    className="ref underline hover:text-accent"
                  >
                    {order.reference ?? order.id.slice(0, 8)}
                  </a>
                </Td>
                <Td>{order.supplier_name ?? '—'}</Td>
                <Td>
                  <StatusBadge status={order.status} />
                </Td>
                <Td align="right">{order.item_count}</Td>
                <Td align="right">{formatMoney(order.total, order.currency)}</Td>
                <Td className="pr-2">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="danger" onClick={() => void archive(order)}>
                      Archive
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {loading && items.length === 0 && <TablePending colSpan={COLUMNS} />}
            {!loading && items.length === 0 && (
              <TableNote colSpan={COLUMNS}>
                {status === '' ? 'No purchase orders yet.' : 'No purchase orders match.'}
              </TableNote>
            )}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}