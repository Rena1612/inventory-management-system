'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Location, Page } from '@/lib/types';
import { LocationForm } from '@/components/locations/LocationForm';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Table, TableNote, TablePending, Td, Th } from '@/components/ui/DataTable';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/ui/PageHeader';

const COLUMNS = 5;

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

      <PageHeader title="Locations" count={items.length} />

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Panel scroll>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Code</Th>
              <Th>Type</Th>
              <Th>Address</Th>
              <Th align="right" className="pr-2">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((location) => (
              <tr key={location.id}>
                <Td>{location.name}</Td>
                <Td className="ref">{location.code ?? '—'}</Td>
                <Td>{location.type}</Td>
                <Td className="text-ink-2">{location.address ?? '—'}</Td>
                <Td className="pr-2">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" onClick={() => setEditing(location)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void archive(location)}>
                      Archive
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {loading && items.length === 0 && <TablePending colSpan={COLUMNS} />}
            {!loading && items.length === 0 && <TableNote colSpan={COLUMNS}>No locations yet.</TableNote>}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}