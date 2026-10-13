'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatMoney, formatQuantity } from '@/lib/format';
import type { Page, Product } from '@/lib/types';
import { ProductForm } from '@/components/products/ProductForm';
import { StockGauge } from '@/components/StockGauge';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Table, TableNote, TablePending, Td, Th } from '@/components/ui/DataTable';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/ui/PageHeader';

const PAGE_SIZE = 20;
const COLUMNS = 7;

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
      closeForm();
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
      <PageHeader
        title="Products"
        count={total}
        actions={
          !formOpen ? (
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add product
            </Button>
          ) : undefined
        }
      />

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
        className="field w-full max-w-xs"
      />

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      <Panel scroll>
        <Table>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Product</Th>
              <Th align="right" className="w-48 pr-2">
                On hand
              </Th>
              <Th align="right">Cost</Th>
              <Th align="right">Sell</Th>
              <Th align="right">Reorder at</Th>
              <Th align="right" className="pr-2">
                Actions
              </Th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="print-keep">
                <Td className="ref">{product.sku}</Td>
                <Td>
                  <Link href={`/products/${product.id}`} className="hover:text-accent">
                    {product.name}
                  </Link>
                </Td>
                <Td className="pr-2">
                  <StockGauge
                    quantity={Number(product.total_quantity)}
                    reorderPoint={Number(product.reorder_point)}
                    reorderQty={Number(product.reorder_qty)}
                    label={formatQuantity(product.total_quantity)}
                    unit={product.unit}
                  />
                </Td>
                <Td align="right" className="text-ink-2">
                  {formatMoney(product.cost_price)}
                </Td>
                <Td align="right" className="text-ink-2">
                  {formatMoney(product.sell_price)}
                </Td>
                <Td align="right" className="text-ink-2">
                  {formatQuantity(product.reorder_point)}
                </Td>
                <Td className="pr-2">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => {
                        setAdding(false);
                        setEditing(product);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void archive(product)}>
                      Archive
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {loading && products.length === 0 && <TablePending colSpan={COLUMNS} />}
            {!loading && products.length === 0 && (
              <TableNote colSpan={COLUMNS}>
                {query === '' ? (
                  <>
                    No products yet.{' '}
                    <Button
                      variant="primary"
                      className="h-auto px-0 text-[13px]"
                      onClick={() => setAdding(true)}
                    >
                      Add the first one
                    </Button>
                  </>
                ) : (
                  `No products match “${query}”.`
                )}
              </TableNote>
            )}
          </tbody>
        </Table>
      </Panel>

      <div className="flex items-center gap-3 text-[12px] text-ink-3">
        <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
          Previous
        </Button>
        <span className="tabular-nums">
          {total === 0 ? 0 : offset + 1}–{offset + products.length} of {total}
        </span>
        <Button disabled={!hasNext} onClick={() => setOffset(offset + PAGE_SIZE)}>
          Next
        </Button>
      </div>
    </div>
  );
}