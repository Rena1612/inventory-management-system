'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { useToast } from '@/components/Toast';

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

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <span className="text-sm text-muted-foreground">{items.length} total</span>
      </div>

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Parent</th>
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((category) => (
            <tr key={category.id} className="border-b">
              <td className="py-2">{category.name}</td>
              <td className="py-2 text-muted-foreground">
                {items.find((item) => item.id === category.parent_id)?.name ?? '—'}
              </td>
              <td className="py-2 text-muted-foreground">{category.description ?? '—'}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(category)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void archive(category)}
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
              <td colSpan={4} className="py-10 text-center text-muted-foreground">
                No categories yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}