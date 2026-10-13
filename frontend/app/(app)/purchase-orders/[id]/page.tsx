'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import { outstandingQuantity, type Location, type Page, type PurchaseOrderDetail } from '@/lib/types';
import { ReceiveForm } from '@/components/purchase-orders/ReceiveForm';
import { StatusBadge } from '@/components/purchase-orders/StatusBadge';
import { PrintButton } from '@/components/PrintButton';

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, locs] = await Promise.all([
        api<PurchaseOrderDetail>(`/api/purchase-orders/${orderId}`),
        api<Page<Location>>('/api/locations', { query: { limit: 200 } }),
      ]);
      setOrder(detail);
      setLocations(locs.items);
    } catch (caught) {
      // Deep-linking an archived or unknown PO should explain itself rather
      // than just render a red string.
      if (caught instanceof ApiError && caught.status === 404) {
        setNotFound(true);
        return;
      }
      setError(
        caught instanceof ApiError ? caught.message : 'Failed to load the purchase order',
      );
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Purchase order not found</h1>
        <p className="text-sm text-muted-foreground">
          It may have been archived, or belong to another organization.
        </p>
        <Link
          href="/purchase-orders"
          className="inline-block rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          Back to purchase orders
        </Link>
      </div>
    );
  }

  if (error !== null) return <p className="text-sm text-destructive">{error}</p>;
  if (order === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const receiveable = order.status === 'open' || order.status === 'partial';

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/purchase-orders" className="text-sm text-muted-foreground underline">
            Purchase orders
          </Link>
          <h1 className="text-2xl font-bold">
            {order.reference ?? order.id.slice(0, 8)}
          </h1>
        </div>
        <PrintButton
          title={`Purchase Order ${order.reference ?? order.id.slice(0, 8)}`}
          generatedAt={new Date().toISOString()}
          organizationName={order.supplier_name}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Status', value: <StatusBadge status={order.status} /> },
          { label: 'Supplier', value: order.supplier_name ?? '—' },
          { label: 'Expected', value: formatDate(order.expected_at) },
          { label: 'Total', value: formatMoney(order.total, order.currency) },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <div className="mt-2 text-xl font-semibold">{card.value}</div>
          </div>
        ))}
      </section>

      {order.notes !== null && (
        <p className="text-sm text-muted-foreground">{order.notes}</p>
      )}

      <section>
        <h2 className="text-lg font-semibold">Lines</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">SKU</th>
              <th className="py-2">Product</th>
              <th className="py-2 text-right">Ordered</th>
              <th className="py-2 text-right">Received</th>
              <th className="py-2 text-right">Outstanding</th>
              <th className="py-2 text-right">Unit cost</th>
              <th className="py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const remaining = outstandingQuantity(item);
              return (
                <tr key={item.id} className="border-b">
                  <td className="py-2 font-mono text-xs">{item.product_sku}</td>
                  <td className="py-2">{item.product_name}</td>
                  <td className="py-2 text-right">{formatQuantity(item.quantity)}</td>
                  <td className="py-2 text-right">{formatQuantity(item.received_qty)}</td>
                  <td
                    className={`py-2 text-right ${remaining > 0 ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}
                  >
                    {formatQuantity(String(remaining))}
                  </td>
                  <td className="py-2 text-right">{formatMoney(item.unit_cost, order.currency)}</td>
                  <td className="py-2 text-right">
                    {formatMoney(
                      String(Number(item.quantity) * Number(item.unit_cost)),
                      order.currency,
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {receiveable ? (
        <ReceiveForm order={order} locations={locations} onReceived={() => void load()} />
      ) : (
        <div className="rounded-lg border p-4">
          <p className="text-sm">
            {order.status === 'received'
              ? 'Fully received — no outstanding quantities remain on this order.'
              : `This order is ${order.status} and cannot receive further stock.`}
          </p>
          {order.received_at !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Received {formatDate(order.received_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}