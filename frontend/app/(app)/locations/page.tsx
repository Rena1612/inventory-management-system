'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Location, Page } from '@/lib/types';
import { LocationForm } from '@/components/locations/LocationForm';
import { useToast } from '@/components/Toast';

export default function LocationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Location[]>([]);
  const [editing, setEditing] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Page<Location>>('/api/locations', { query: { limit: 100 } });
      setItems(result.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(location: Location) {
    if (!window.confirm(`Archive "${location.name}"?`)) return;
    try {
      await api(`/api/locations/${location.id}`, { method: 'DELETE' });
      toast.push(`Archived ${location.name}`);
      if (editing?.id === location.id) setEditing(null);
      void load();
    } catch (caught) {
      toast.push(
        caught instanceof ApiError ? caught.message : 'Could not archive the location',
        'error',
      );
    }
  }

  return (
    <div className="space-y-6">
      <LocationForm
        editing={editing}
        locations={items}
        onCancelEdit={() => setEditing(null)}
        onSaved={() => void load()}
      />

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Locations</h1>
        <span className="text-sm text-muted-foreground">{items.length} total</span>
      </div>

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Code</th>
            <th className="py-2">Type</th>
            <th className="py-2">Address</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((location) => (
            <tr key={location.id} className="border-b">
              <td className="py-2">{location.name}</td>
              <td className="py-2 font-mono text-xs">{location.code ?? '—'}</td>
              <td className="py-2">{location.type}</td>
              <td className="py-2 text-muted-foreground">{location.address ?? '—'}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(location)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void archive(location)}
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
                No locations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}