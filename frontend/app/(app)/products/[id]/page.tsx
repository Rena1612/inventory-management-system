'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { formatDateTime, formatMoney, formatQuantity, movementLabel } from '@/lib/format';
import type { Movement, Page, ProductDetail } from '@/lib/types';
import { Table, TableNote, Td, Th } from '@/components/ui/DataTable';
import { LoadingNote, PageError } from '@/components/ui/Notice';
import { Figure, FigureStrip, Panel } from '@/components/ui/Panel';
import { PageHeader, SectionHead } from '@/components/ui/PageHeader';

const STOCK_COLUMNS = 5;
const HISTORY_COLUMNS = 6;

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
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
      setError(caught);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return <PageError error={error} fallback="The product could not be loaded." onRetry={load} />;
  }
  if (product === null) return <LoadingNote />;

  const figures = [
    { label: 'On hand', value: formatQuantity(product.total_quantity) },
    { label: 'Cost', value: formatMoney(product.cost_price) },
    { label: 'Sell', value: formatMoney(product.sell_price) },
    { label: 'Reorder point', value: formatQuantity(product.reorder_point) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={product.name} />
      <p className="text-[13px] text-ink-2">
        <span className="ref">{product.sku}</span>
        {product.category_name !== null && ` · ${product.category_name}`}
        {product.supplier_name !== null && ` · ${product.supplier_name}`}
      </p>

      <FigureStrip>
        {figures.map((figure) => (
          <Figure key={figure.label} label={figure.label} value={figure.value} />
        ))}
      </FigureStrip>

      <section className="space-y-2">
        <SectionHead>
          Stock by location
          <span className="ml-2 tabular-nums text-ink-3">{product.stock.length}</span>
        </SectionHead>
        <Panel scroll>
          <Table>
            <thead>
              <tr>
                <Th>Location</Th>
                <Th>Type</Th>
                <Th align="right">Quantity</Th>
                <Th align="right">Reserved</Th>
                <Th align="right">Updated</Th>
              </tr>
            </thead>
            <tbody>
              {product.stock.map((level) => (
                <tr key={level.location_id}>
                  <Td>{level.location_name}</Td>
                  <Td className="text-ink-2">{level.location_type ?? '—'}</Td>
                  <Td align="right">{formatQuantity(level.quantity)}</Td>
                  <Td align="right">{formatQuantity(level.reserved)}</Td>
                  <Td align="right" className="text-ink-2">
                    {formatDateTime(level.updated_at)}
                  </Td>
                </tr>
              ))}
              {product.stock.length === 0 && (
                <TableNote colSpan={STOCK_COLUMNS}>No stock recorded at any location.</TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>

      <section className="space-y-2">
        <SectionHead>
          Movement history
          <span className="ml-2 tabular-nums text-ink-3">{history.length}</span>
        </SectionHead>
        <Panel scroll>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Type</Th>
                <Th>Location</Th>
                <Th>User</Th>
                <Th align="right">Quantity</Th>
                <Th align="right">Reference</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((movement) => (
                <tr key={movement.id}>
                  <Td className="whitespace-nowrap text-ink-2">
                    {formatDateTime(movement.created_at)}
                  </Td>
                  <Td className="text-ink-2">{movementLabel(movement.type)}</Td>
                  <Td>{movement.location_name ?? '—'}</Td>
                  <Td className="text-ink-2">{movement.user_email ?? 'system'}</Td>
                  <Td align="right">{formatQuantity(movement.quantity)}</Td>
                  <Td align="right" className="ref">
                    {movement.reference ?? '—'}
                  </Td>
                </tr>
              ))}
              {history.length === 0 && (
                <TableNote colSpan={HISTORY_COLUMNS}>No movements recorded yet.</TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>
    </div>
  );
}