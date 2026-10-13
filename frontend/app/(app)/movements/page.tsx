'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatQuantity, movementLabel } from '@/lib/format';
import type { Movement, Page } from '@/lib/types';

import { MovementForm } from '@/components/movements/MovementForm';
import { Button } from '@/components/ui/Button';
import { Table, TableNote, TablePending, Td, Th } from '@/components/ui/DataTable';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/ui/PageHeader';

const TYPES = ['in', 'out', 'adjust', 'transfer_in', 'transfer_out'] as const;

const COLUMNS = 7;
const PAGE_SIZE = 25;

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
        query: { type: type || undefined, limit: PAGE_SIZE, offset },
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

      <PageHeader title="Movements" count={total} />

      <div className="flex gap-3">
        <select
          value={type}
          onChange={(event) => {
            setOffset(0);
            setType(event.target.value);
          }}
          aria-label="Filter by movement type"
          className="field w-48"
        >
          <option value="">All types</option>
          {TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Panel scroll>
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Type</Th>
              <Th>Product</Th>
              <Th>Location</Th>
              <Th>User</Th>
              <Th align="right">Quantity</Th>
              <Th align="right" className="pr-2">Reference</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((movement) => (
              <tr key={movement.id}>
                <Td className="whitespace-nowrap text-ink-2">
                  {formatDateTime(movement.created_at)}
                </Td>
                <Td className="text-ink-2">{movementLabel(movement.type)}</Td>
                <Td>
                  <span className="ref">{movement.product_sku}</span>
                  <span className="ml-2">{movement.product_name}</span>
                </Td>
                <Td>{movement.location_name ?? '—'}</Td>
                <Td className="text-ink-2">{movement.user_email ?? 'system'}</Td>
                <Td align="right">{formatQuantity(movement.quantity)}</Td>
                <Td align="right" className="ref pr-2">
                  {movement.reference ?? '—'}
                </Td>
              </tr>
            ))}
            {loading && items.length === 0 && <TablePending colSpan={COLUMNS} />}
            {!loading && items.length === 0 && (
              <TableNote colSpan={COLUMNS}>No movements match.</TableNote>
            )}
          </tbody>
        </Table>
      </Panel>

      <div className="flex items-center gap-3 text-[12px] text-ink-3">
        <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
          Previous
        </Button>
        <span className="tabular-nums">
          {total === 0 ? 0 : offset + 1}–{offset + items.length} of {total}
        </span>
        <Button disabled={offset + items.length >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
          Next
        </Button>
      </div>
    </div>
  );
}