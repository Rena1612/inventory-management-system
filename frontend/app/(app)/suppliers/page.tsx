'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Page, Supplier } from '@/lib/types';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import { useToast } from '@/components/Toast';

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

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <span className="text-sm text-muted-foreground">{items.length} total</span>
      </div>

      <input
        type="search"
        value={query}
        placeholder="Search suppliers…"
        onChange={(event) => setQuery(event.target.value)}
        className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
      />

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Phone</th>
            <th className="py-2">Address</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((supplier) => (
            <tr key={supplier.id} className="border-b">
              <td className="py-2">{supplier.name}</td>
              <td className="py-2 text-muted-foreground">{supplier.email ?? '—'}</td>
              <td className="py-2 text-muted-foreground">{supplier.phone ?? '—'}</td>
              <td className="py-2 text-muted-foreground">{supplier.address ?? '—'}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(supplier)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void archive(supplier)}
                    className="rounded-md border px-2 py-1 text-xs text-destructive hover:bg-muted"
                  >
                    Archive
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-muted-foreground">
                {query === '' ? 'No suppliers yet.' : 'No suppliers match.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}