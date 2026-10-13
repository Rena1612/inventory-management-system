'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import type { Movement, Page, ProductDetail } from '@/lib/types';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [detail, movements] = await Promise.all([
          api<ProductDetail>(`/api/products/${productId}`),
          api<Page<Movement>>(`/api/movements/product/${productId}`, {
            query: { limit: 100 },
          }),
        ]);
        setProduct(detail);
        setHistory(movements.items);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Failed to load product');
      }
    })();
  }, [productId]);

  if (error !== null) return <p className="text-sm text-destructive">{error}</p>;
  if (product === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{product.sku}</span>
          {product.category_name !== null && ` · ${product.category_name}`}
          {product.supplier_name !== null && ` · ${product.supplier_name}`}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'On hand', value: formatQuantity(product.total_quantity) },
          { label: 'Cost', value: formatMoney(product.cost_price) },
          { label: 'Sell', value: formatMoney(product.sell_price) },
          { label: 'Reorder point', value: formatQuantity(product.reorder_point) },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-xl font-semibold">{card.value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Stock by location</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Location</th>
              <th className="py-2">Type</th>
              <th className="py-2 text-right">Quantity</th>
              <th className="py-2 text-right">Reserved</th>
              <th className="py-2 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {product.stock.map((level) => (
              <tr key={level.location_id} className="border-b">
                <td className="py-2">{level.location_name}</td>
                <td className="py-2">{level.location_type ?? '—'}</td>
                <td className="py-2 text-right">{formatQuantity(level.quantity)}</td>
                <td className="py-2 text-right">{formatQuantity(level.reserved)}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {formatDateTime(level.updated_at)}
                </td>
              </tr>
            ))}
            {product.stock.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  No stock recorded at any location.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Movement history</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">When</th>
              <th className="py-2">Type</th>
              <th className="py-2">Location</th>
              <th className="py-2">User</th>
              <th className="py-2 text-right">Quantity</th>
              <th className="py-2 text-right">Reference</th>
            </tr>
          </thead>
          <tbody>
            {history.map((movement) => (
              <tr key={movement.id} className="border-b">
                <td className="py-2">{formatDateTime(movement.created_at)}</td>
                <td className="py-2">{movement.type}</td>
                <td className="py-2">{movement.location_name ?? '—'}</td>
                <td className="py-2">{movement.user_email ?? 'system'}</td>
                <td className="py-2 text-right">{formatQuantity(movement.quantity)}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {movement.reference ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}