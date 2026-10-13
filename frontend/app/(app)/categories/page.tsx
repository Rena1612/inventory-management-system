'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Table, TableNote, TablePending, Td, Th } from '@/components/ui/DataTable';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/ui/PageHeader';

const COLUMNS = 4;

export default function CategoriesPage() {
  const toast = useToast();
  const [items, setItems] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // This endpoint returns a plain array rather than a paginated envelope.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api<Category[]>('/api/categories'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(category: Category) {
    if (!window.confirm(`Archive "${category.name}"?`)) return;
    try {
      await api(`/api/categories/${category.id}`, { method: 'DELETE' });
      toast.push(`Archived ${category.name}`);
      if (editing?.id === category.id) setEditing(null);
      void load();
    } catch (caught) {
      toast.push(
        caught instanceof ApiError ? caught.message : 'Could not archive the category',
        'error',
      );
    }
  }

  return (
    <div className="space-y-6">
      <CategoryForm
        editing={editing}
        categories={items}
        onCancelEdit={() => setEditing(null)}
        onSaved={() => void load()}
      />

      <PageHeader title="Categories" count={items.length} />

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Panel scroll>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Parent</Th>
              <Th>Description</Th>
              <Th align="right" className="pr-2">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((category) => (
              <tr key={category.id}>
                <Td>{category.name}</Td>
                <Td className="text-ink-2">
                  {items.find((item) => item.id === category.parent_id)?.name ?? '—'}
                </Td>
                <Td className="text-ink-2">{category.description ?? '—'}</Td>
                <Td className="pr-2">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" onClick={() => setEditing(category)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void archive(category)}>
                      Archive
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {loading && items.length === 0 && <TablePending colSpan={COLUMNS} />}
            {!loading && items.length === 0 && (
              <TableNote colSpan={COLUMNS}>No categories yet.</TableNote>
            )}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}