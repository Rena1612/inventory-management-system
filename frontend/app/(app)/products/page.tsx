'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatMoney, formatQuantity } from '@/lib/format';
import type { Page, Product } from '@/lib/types';
import { ProductForm } from '@/components/products/ProductForm';
import { StockGauge } from '@/components/StockGauge';
import { useToast } from '@/components/Toast';

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Page<Product>>('/api/products', {
        query: { q: query || undefined, limit: PAGE_SIZE, offset },
      });
      setProducts(result.items);
      setTotal(result.meta.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [query, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasNext = offset + products.length < total;
  const formOpen = adding || editing !== null;

  function closeForm() {
    setAdding(false);
    setEditing(null);
  }

  async function archive(product: Product) {
    const warning = 'This is a soft delete. Products holding stock cannot be archived.';
    if (!window.confirm(`Archive "${product.name}" (${product.sku})?\n\n${warning}`)) return;
    try {
      await api(`/api/products/${product.id}`, { method: 'DELETE' });
      toast.push(`Archived ${product.sku}`);
      if (editing?.id === product.id) setEditing(null);
      void load();
    } catch (caught) {
      toast.push(
        caught instanceof ApiError ? caught.message : 'Could not archive the product',
        'error',
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h1 className="text-[15px] font-semibold text-ink">
          Products
          <span className="ml-2 text-[13px] font-normal tabular-nums text-ink-3">{total}</span>
        </h1>
        {!formOpen && (
          <button type="button" onClick={() => setAdding(true)} className="btn-primary">
            Add product
          </button>
        )}
      </div>

      {formOpen && (
        <ProductForm
          editing={editing}
          onCancelEdit={closeForm}
          onSaved={() => {
            setAdding(false);
            void load();
          }}
        />
      )}

      <input
        type="search"
        value={query}
        aria-label="Search products"
        placeholder="Search by name or SKU"
        onChange={(event) => {
          setOffset(0);
          setQuery(event.target.value);
        }}
        className="field w-64"
      />

      {error !== null && <p className="text-[13px] text-destructive">{error}</p>}

      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="th">SKU</th>
              <th className="th">Product</th>
              <th className="th w-40 pr-2 text-right">On hand</th>
              <th className="th text-right">Cost</th>
              <th className="th text-right">Sell</th>
              <th className="th text-right">Reorder at</th>
              <th className="th pr-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="print-keep">
                <td className="td ref">{product.sku}</td>
                <td className="td">
                  <Link href={`/products/${product.id}`} className="hover:text-accent">
                    {product.name}
                  </Link>
                </td>
                <td className="td pr-2">
                  <StockGauge
                    quantity={Number(product.total_quantity)}
                    reorderPoint={Number(product.reorder_point)}
                    reorderQty={Number(product.reorder_qty)}
                    label={formatQuantity(product.total_quantity)}
                    unit={product.unit}
                  />
                </td>
                <td className="td num text-ink-2">{formatMoney(product.cost_price)}</td>
                <td className="td num text-ink-2">{formatMoney(product.sell_price)}</td>
                <td className="td num text-ink-2">{formatQuantity(product.reorder_point)}</td>
                <td className="td pr-2">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setEditing(product);
                      }}
                      className="btn-ghost btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void archive(product)}
                      className="btn-danger btn-sm"
                    >
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={7} className="td py-8 text-center text-ink-3">
                  {query === '' ? (
                    <>
                      No products yet.{' '}
                      <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="text-accent hover:text-accent-deep"
                      >
                        Add the first one
                      </button>
                    </>
                  ) : (
                    `No products match “${query}”.`
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-[12px] text-ink-3">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          className="btn-ghost"
        >
          Previous
        </button>
        <span className="tabular-nums">
          {total === 0 ? 0 : offset + 1}–{offset + products.length} of {total}
        </span>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => setOffset(offset + PAGE_SIZE)}
          className="btn-ghost"
        >
          Next
        </button>
      </div>
    </div>
  );
}