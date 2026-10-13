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
import { Table, TableNote, Td, Th } from '@/components/ui/DataTable';
import { LoadingNote, PageError } from '@/components/ui/Notice';
import { Figure, FigureStrip, Panel } from '@/components/ui/Panel';
import { PageHeader, SectionHead } from '@/components/ui/PageHeader';

const LINE_COLUMNS = 7;

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<unknown>(null);
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
      setError(caught);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <div className="space-y-3">
        <Link href="/purchase-orders" className="text-[13px] text-ink-2 underline">
          Purchase orders
        </Link>
        <PageHeader title="Purchase order not found" />
        <p className="text-[13px] text-ink-2">
          It may have been archived, or belong to another organization.
        </p>
        <Link href="/purchase-orders" className="btn-ghost">
          Back to purchase orders
        </Link>
      </div>
    );
  }

  if (error !== null) {
    return (
      <PageError
        error={error}
        fallback="The purchase order could not be loaded."
        onRetry={load}
      />
    );
  }
  if (order === null) return <LoadingNote />;

  const receiveable = order.status === 'open' || order.status === 'partial';
  const label = order.reference ?? order.id.slice(0, 8);

  return (
    <div className="space-y-6">
      <Link href="/purchase-orders" className="text-[13px] text-ink-2 underline">
        Purchase orders
      </Link>

      <PageHeader
        title={label}
        actions={
          <>
            <StatusBadge status={order.status} />
            <PrintButton
              title={`Purchase Order ${label}`}
              generatedAt={new Date().toISOString()}
              organizationName={order.supplier_name}
            />
          </>
        }
      />

      <FigureStrip>
        <Figure label="Supplier" value={order.supplier_name ?? '—'} />
        <Figure label="Expected" value={formatDate(order.expected_at)} />
        <Figure label="Total" value={formatMoney(order.total, order.currency)} />
      </FigureStrip>

      {order.notes !== null && <p className="text-[13px] text-ink-2">{order.notes}</p>}

      <section className="space-y-2">
        <SectionHead>
          Lines
          <span className="ml-2 tabular-nums text-ink-3">{order.items.length}</span>
        </SectionHead>
        <Panel scroll>
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Product</Th>
                <Th align="right">Ordered</Th>
                <Th align="right">Received</Th>
                <Th align="right">Outstanding</Th>
                <Th align="right">Unit cost</Th>
                <Th align="right" className="pr-2">Line total</Th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const remaining = outstandingQuantity(item);
                return (
                  <tr key={item.id}>
                    <Td className="ref">{item.product_sku}</Td>
                    <Td>{item.product_name}</Td>
                    <Td align="right">{formatQuantity(item.quantity)}</Td>
                    <Td align="right">{formatQuantity(item.received_qty)}</Td>
                    <Td
                      align="right"
                      className={remaining > 0 ? 'font-medium text-stock-low' : 'text-ink-2'}
                    >
                      {formatQuantity(String(remaining))}
                    </Td>
                    <Td align="right" className="text-ink-2">
                      {formatMoney(item.unit_cost, order.currency)}
                    </Td>
                    <Td align="right" className="pr-2">
                      {formatMoney(
                        String(Number(item.quantity) * Number(item.unit_cost)),
                        order.currency,
                      )}
                    </Td>
                  </tr>
                );
              })}
              {order.items.length === 0 && (
                <TableNote colSpan={LINE_COLUMNS}>This order has no lines.</TableNote>
              )}
            </tbody>
          </Table>
        </Panel>
      </section>

      {receiveable ? (
        <ReceiveForm order={order} locations={locations} onReceived={() => void load()} />
      ) : (
        <Panel className="space-y-1 p-4">
          <p className="text-[13px]">
            {order.status === 'received'
              ? 'Fully received — no outstanding quantities remain on this order.'
              : `This order is ${order.status} and cannot receive further stock.`}
          </p>
          {order.received_at !== null && (
            <p className="text-[11px] text-ink-3">
              Received {formatDate(order.received_at)}
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}