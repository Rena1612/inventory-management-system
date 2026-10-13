'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Location, Page, PurchaseOrder } from '@/lib/types';
import { StatusBadge } from '@/components/purchase-orders/StatusBadge';
import { PurchaseOrderForm } from '@/components/purchase-orders/PurchaseOrderForm';
import { useToast } from '@/components/Toast';

const STATUSES = ['draft', 'open', 'partial', 'received', 'cancelled'] as const;

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

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <span className="text-sm text-muted-foreground">{total} total</span>
      </div>

      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        aria-label="Filter by status"
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2">Reference</th>
            <th className="py-2">Supplier</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Items</th>
            <th className="py-2 text-right">Total</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((order) => (
            <tr key={order.id} className="border-b">
              <td className="py-2">
                <a href={`/purchase-orders/${order.id}`} className="font-mono text-xs underline">
                  {order.reference ?? order.id.slice(0, 8)}
                </a>
              </td>
              <td className="py-2">{order.supplier_name ?? '—'}</td>
              <td className="py-2">
                <StatusBadge status={order.status} />
              </td>
              <td className="py-2 text-right">{order.item_count}</td>
              <td className="py-2 text-right">{formatMoney(order.total, order.currency)}</td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => void archive(order)}
                  className="rounded-md border px-2 py-1 text-xs text-destructive hover:bg-muted"
                >
                  Archive
                </button>
              </td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-muted-foreground">
                {status === '' ? 'No purchase orders yet.' : 'No purchase orders match.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}