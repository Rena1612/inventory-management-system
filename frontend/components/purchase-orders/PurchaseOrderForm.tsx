'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/api';
import type { Location, Page, Product, PurchaseOrder, Supplier } from '@/lib/types';
import { Field, FormError, FormSection, fieldClass, optional, parseDecimal } from '@/components/form/Primitives';
import {
  PurchaseOrderLines,
  newLine,
  type LineState,
} from '@/components/purchase-orders/PurchaseOrderLines';
import { useToast } from '@/components/Toast';

export function PurchaseOrderForm() {
  const router = useRouter();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineState[]>([newLine()]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [s, p, l] = await Promise.all([
          api<Page<Supplier>>('/api/suppliers', { query: { limit: 200 } }),
          api<Page<Product>>('/api/products', { query: { limit: 200 } }),
          api<Page<Location>>('/api/locations', { query: { limit: 200 } }),
        ]);
        setSuppliers(s.items);
        setProducts(p.items);
        setLocations(l.items);
        setSupplierId((current) => current || s.items[0]?.id || '');
      } catch {
        // The form degrades to empty pickers rather than blocking submission.
      }
    })();
  }, []);

  const total = lines.reduce((sum, line) => {
    const qty = parseDecimal(line.quantity);
    const cost = parseDecimal(line.unit_cost);
    if (qty === null || cost === null) return sum;
    return sum + qty * cost;
  }, 0);

  function validate(): string | null {
    if (supplierId === '') return 'Choose a supplier';
    const filled = lines.filter((line) => line.product_id !== '');
    if (filled.length === 0) return 'Add at least one product line';

    const seen = new Set<string>();
    for (const line of filled) {
      if (seen.has(line.product_id)) return 'A product can only appear on one line';
      seen.add(line.product_id);

      const qty = parseDecimal(line.quantity);
      if (qty === null || qty <= 0) return 'Every line needs a quantity greater than zero';
      const cost = parseDecimal(line.unit_cost);
      if (cost === null || cost < 0) return 'Unit costs must be zero or more';
    }
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem !== null) {
      setError(problem);
      return;
    }

    const items = lines
      .filter((line) => line.product_id !== '')
      .map((line) => ({
        product_id: line.product_id,
        quantity: String(parseDecimal(line.quantity) ?? 0),
        unit_cost: String(parseDecimal(line.unit_cost) ?? 0),
        location_id: line.location_id === '' ? null : line.location_id,
      }));

    setBusy(true);
    setError(null);
    try {
      const created = await api<PurchaseOrder>('/api/purchase-orders', {
        method: 'POST',
        body: {
          supplier_id: supplierId,
          reference: optional(reference),
          // datetime-local has no zone; send UTC midnight so the API parses it.
          expected_at:
            expectedAt === '' ? null : new Date(`${expectedAt}T00:00:00Z`).toISOString(),
          notes: optional(notes),
          items,
        },
      });
      toast.push(`Created purchase order ${created.reference ?? created.id.slice(0, 8)}`);
      setReference('');
      setExpectedAt('');
      setNotes('');
      setLines([newLine()]);
      // The create response carries no item array, so land on the detail page.
      router.push(`/purchase-orders/${created.id}`);
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : 'Could not create the purchase order';
      setError(message);
      toast.push(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection title="Purchase orders" editing={null} createLabel="Create purchase order">
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Supplier" htmlFor="po-supplier">
          <select
            id="po-supplier"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Select a supplier…</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reference" htmlFor="po-reference">
          <input
            id="po-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="PO-2026-01"
            className={fieldClass}
          />
        </Field>

        <Field label="Expected" htmlFor="po-expected">
          <input
            id="po-expected"
            type="date"
            value={expectedAt}
            onChange={(event) => setExpectedAt(event.target.value)}
            className={fieldClass}
          />
        </Field>

        <Field label="Notes" htmlFor="po-notes">
          <input
            id="po-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>

      <PurchaseOrderLines
        lines={lines}
        products={products}
        locations={locations}
        total={total}
        onChange={setLines}
      />

      <FormError message={error} />

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create purchase order'}
      </button>
    </FormSection>
  );
}