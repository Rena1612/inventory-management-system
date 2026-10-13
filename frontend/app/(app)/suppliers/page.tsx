'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Page, Supplier } from '@/lib/types';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Table, TableNote, TablePending, Td, Th } from '@/components/ui/DataTable';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/ui/PageHeader';

const COLUMNS = 5;

export default function SuppliersPage() {
  const toast = useToast();
  const [items, setItems] = useState<Supplier[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Page<Supplier>>('/api/suppliers', {
        query: { q: query || undefined, limit: 100 },
      });
      setItems(result.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(supplier: Supplier) {
    if (!window.confirm(`Archive "${supplier.name}"? It will no longer be selectable.`)) return;
    try {
      await api(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
      toast.push(`Archived ${supplier.name}`);
      if (editing?.id === supplier.id) setEditing(null);
      void load();
    } catch (caught) {
      toast.push(
        caught instanceof ApiError ? caught.message : 'Could not archive the supplier',
        'error',
      );
    }
  }

  return (
    <div className="space-y-6">
      <SupplierForm
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSaved={() => void load()}
      />

      <PageHeader title="Suppliers" count={items.length} />

      <input
        type="search"
        value={query}
        aria-label="Search suppliers"
        placeholder="Search suppliers…"
        onChange={(event) => setQuery(event.target.value)}
        className="field w-full max-w-xs"
      />

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Panel scroll>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Address</Th>
              <Th align="right" className="pr-2">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((supplier) => (
              <tr key={supplier.id}>
                <Td>{supplier.name}</Td>
                <Td className="text-ink-2">{supplier.email ?? '—'}</Td>
                <Td className="text-ink-2">{supplier.phone ?? '—'}</Td>
                <Td className="text-ink-2">{supplier.address ?? '—'}</Td>
                <Td className="pr-2">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" onClick={() => setEditing(supplier)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void archive(supplier)}>
                      Archive
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {loading && items.length === 0 && <TablePending colSpan={COLUMNS} />}
            {!loading && items.length === 0 && (
              <TableNote colSpan={COLUMNS}>
                {query === '' ? 'No suppliers yet.' : 'No suppliers match.'}
              </TableNote>
            )}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}