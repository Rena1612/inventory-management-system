'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import {
  outstandingQuantity,
  type Location,
  type PurchaseOrder,
  type PurchaseOrderDetail,
  type PurchaseOrderItem,
} from '@/lib/types';
import {
  Field,
  FormError,
  FormSection,
  fieldClass,
  optional,
  parseDecimal,
} from '@/components/form/Primitives';
import { ReceiveLine } from '@/components/purchase-orders/ReceiveLine';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';

interface Props {
  order: PurchaseOrderDetail;
  locations: Location[];
  onReceived: () => void;
}

interface Line {
  item: PurchaseOrderItem;
  remaining: number;
  qty: number;
  value: number;
}

export function ReceiveForm({ order, locations, onReceived }: Props) {
  const toast = useToast();

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [defaultLocation, setDefaultLocation] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A ref flips synchronously, so a double-click cannot slip past before the
  // busy state has re-rendered.
  const submitting = useRef(false);

  const lines: Line[] = useMemo(
    () =>
      order.items.map((item) => {
        const remaining = outstandingQuantity(item);
        const parsed = parseDecimal(quantities[item.product_id] ?? '');
        const qty = remaining > 0 && parsed !== null && parsed > 0 ? parsed : 0;
        return { item, remaining, qty, value: qty * Number(item.unit_cost) };
      }),
    [order.items, quantities],
  );

  const pending = lines.filter((line) => line.remaining > 0);
  const willReceive = lines.filter((line) => line.qty > 0);
  const receiveValue = willReceive.reduce((sum, line) => sum + line.value, 0);

  // Default every outstanding line to its full remainder: a clean delivery is
  // the common case and should not need retyping.
  const resetToOutstanding = useCallback(() => {
    const seeded: Record<string, string> = {};
    for (const item of order.items) {
      const remaining = outstandingQuantity(item);
      if (remaining > 0) seeded[item.product_id] = String(remaining);
    }
    setQuantities(seeded);
  }, [order.items]);

  useEffect(() => {
    resetToOutstanding();
  }, [resetToOutstanding]);

  function setQty(productId: string, value: string) {
    setQuantities((current) => ({ ...current, [productId]: value }));
  }

  async function submit() {
    if (submitting.current) return;
    if (pending.length === 0) {
      setError('Nothing outstanding on this order');
      return;
    }

    const chosen: Line[] = [];
    for (const line of pending) {
      const raw = quantities[line.item.product_id] ?? '';
      if (raw.trim() === '') continue; // blank means skip this line

      const qty = parseDecimal(raw);
      if (qty === null) {
        setError('Received quantities must be numbers');
        return;
      }
      if (qty < 0) {
        setError('Received quantities cannot be negative');
        return;
      }
      // The database enforces this too; checking here gives a readable message.
      if (qty > line.remaining) {
        setError(
          `${line.item.product_sku ?? 'Product'}: cannot receive ${qty}, only ${line.remaining} outstanding`,
        );
        return;
      }
      if (qty > 0) chosen.push({ ...line, qty, value: qty * Number(line.item.unit_cost) });
    }

    if (chosen.length === 0) {
      setError('Enter a quantity on at least one line');
      return;
    }

    // The server needs somewhere to put the stock for every chosen line. Catch
    // that here rather than surfacing an opaque 409.
    const undirected = chosen.find(
      ({ item }) => defaultLocation === '' && item.location_id === null,
    );
    if (undirected !== undefined) {
      setError(
        `Choose a receiving location for ${
          undirected.item.product_sku ?? 'a line'
        } — it has no destination of its own`,
      );
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      // One call: the server inserts every movement, updates every line and
      // advances the status inside a single transaction.
      const updated = await api<PurchaseOrder>(`/api/purchase-orders/${order.id}/receive`, {
        method: 'POST',
        body: {
          location_id: defaultLocation === '' ? null : defaultLocation,
          note: optional(note),
          items: chosen.map(({ item, qty }) => ({
            product_id: item.product_id,
            received_qty: String(qty),
            location_id: null,
          })),
        },
      });
      toast.push(
        `Received ${chosen.length} ${chosen.length === 1 ? 'line' : 'lines'} on ${
          order.reference ?? order.id.slice(0, 8)
        } — now ${updated.status}`,
      );
      setNote('');
      // Stay on this page: the rest often arrives the same day.
      onReceived();
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : 'Could not record the receipt';
      setError(message);
      toast.push(message, 'error');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (pending.length === 0) {
    return (
      <FormSection title="Goods receipt" editing={null} createLabel="Goods receipt">
        <p className="text-[13px] text-ink-2">
          Every line on this order has been received in full.
        </p>
      </FormSection>
    );
  }

  return (
    <FormSection title="Goods receipt" editing={null} createLabel="Receive goods">
      <p className="text-[13px] text-ink-2">
        Defaulted to everything outstanding. Clear a line to skip it, or lower it for a
        short delivery. Locations fall back to each line&apos;s destination, then the
        default below.
      </p>

      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[11px] text-ink-3">
          <span className="col-span-4">Product</span>
          <span className="col-span-2 text-right">Ordered</span>
          <span className="col-span-2 text-right">Received</span>
          <span className="col-span-2 text-right">Outstanding</span>
          <span className="col-span-2">Receiving now</span>
        </div>

        {lines.map(({ item, remaining }) => (
          <ReceiveLine
            key={item.id}
            item={item}
            remaining={remaining}
            inputValue={quantities[item.product_id] ?? ''}
            onChange={(value) => setQty(item.product_id, value)}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Default receiving location"
          htmlFor="receive-location"
          hint="Used when a line has no destination of its own"
        >
          <select
            id="receive-location"
            value={defaultLocation}
            onChange={(event) => setDefaultLocation(event.target.value)}
            className={fieldClass}
          >
            <option value="">Use each line&apos;s destination</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Note" htmlFor="receive-note">
          <input
            id="receive-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Delivery note, carrier…"
            className={fieldClass}
          />
        </Field>
      </div>

      <p className="text-[13px]" aria-live="polite">
        {willReceive.length === 0 ? (
          <span className="text-ink-2">Nothing selected to receive yet.</span>
        ) : (
          <span className="text-ink-2">
            Will receive{' '}
            <span className="font-medium text-ink">
              {willReceive.length} {willReceive.length === 1 ? 'line' : 'lines'}
            </span>{' '}
            worth{' '}
            <span className="font-medium tabular-nums text-ink">
              {formatMoney(String(receiveValue), order.currency)}
            </span>
          </span>
        )}
      </p>

      <FormError message={error} />

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={() => void submit()} disabled={busy || willReceive.length === 0}>
          {busy ? 'Receiving…' : 'Receive goods'}
        </Button>
        <Button onClick={resetToOutstanding} disabled={busy}>
          Reset to all outstanding
        </Button>
      </div>
    </FormSection>
  );
}