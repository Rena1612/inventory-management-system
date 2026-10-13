'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatQuantity } from '@/lib/format';
import type { Movement, Page } from '@/lib/types';

import { MovementForm } from '@/components/movements/MovementForm';

const TYPES = ['in', 'out', 'adjust', 'transfer_in', 'transfer_out'] as const;

export default function MovementsPage() {
  const [items, setItems] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState('');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Page<Movement>>('/api/movements', {
        query: { type: type || undefined, limit: 25, offset },
      });
      setItems(result.items);
      setTotal(result.meta.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }, [type, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <MovementForm onRecorded={() => void load()} />

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Movements</h1>
        <span className="text-sm text-muted-foreground">{total} in the ledger</span>
      </div>

      <div className="flex gap-3">
        <select
          value={type}
          onChange={(event) => {
            setOffset(0);
            setType(event.target.value);
          }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2">When</th>
            <th className="py-2">Type</th>
            <th className="py-2">Product</th>
            <th className="py-2">Location</th>
            <th className="py-2">User</th>
            <th className="py-2 text-right">Quantity</th>
            <th className="py-2 text-right">Reference</th>
          </tr>
        </thead>
        <tbody>
          {items.map((movement) => (
            <tr key={movement.id} className="border-b">
              <td className="py-2">{formatDateTime(movement.created_at)}</td>
              <td className="py-2">{movement.type}</td>
              <td className="py-2">
                {movement.product_sku} — {movement.product_name}
              </td>
              <td className="py-2">{movement.location_name ?? '—'}</td>
              <td className="py-2">{movement.user_email ?? 'system'}</td>
              <td className="py-2 text-right">{formatQuantity(movement.quantity)}</td>
              <td className="py-2 text-right text-muted-foreground">
                {movement.reference ?? '—'}
              </td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-muted-foreground">
                No movements match.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex items-center gap-4 text-sm">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 25))}
          className="rounded-md border px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-muted-foreground">
          {total === 0 ? 0 : offset + 1}–{offset + items.length} of {total}
        </span>
        <button
          type="button"
          disabled={offset + items.length >= total}
          onClick={() => setOffset(offset + 25)}
          className="rounded-md border px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}