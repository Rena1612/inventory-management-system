'use client';

import { useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Category, Location, Page, Product, Supplier } from '@/lib/types';
import { FormActions, FormError, FormSection, optional, parseDecimal } from '@/components/form/Primitives';
import {
  EMPTY_PRODUCT,
  ProductFields,
  productToState,
  type ProductFormState,
} from '@/components/products/ProductFields';
import { useToast } from '@/components/Toast';

interface Props {
  editing: Product | null;
  onCancelEdit: () => void;
  onSaved: () => void;
}

export function ProductForm({ editing, onCancelEdit, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(editing === null ? EMPTY_PRODUCT : productToState(editing));
    setError(null);
  }, [editing]);

  useEffect(() => {
    void (async () => {
      try {
        const [c, s, l] = await Promise.all([
          api<Category[]>('/api/categories'),
          api<Page<Supplier>>('/api/suppliers', { query: { limit: 200 } }),
          api<Page<Location>>('/api/locations', { query: { limit: 200 } }),
        ]);
        setCategories(c);
        setSuppliers(s.items);
        setLocations(l.items);
      } catch {
        // Optional pickers degrade to "none available" rather than blocking the form.
      }
    })();
  }, []);

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /** @returns an error message, or null when the form is valid. */
  function validate(): { message: string; opening: number } | null {
    if (form.sku.trim() === '') return { message: 'SKU is required', opening: 0 };
    if (form.name.trim() === '') return { message: 'Name is required', opening: 0 };

    const cost = parseDecimal(form.cost_price);
    const sell = parseDecimal(form.sell_price);
    const point = parseDecimal(form.reorder_point);
    const reorderQty = parseDecimal(form.reorder_qty);
    if (cost === null || sell === null || point === null || reorderQty === null) {
      return { message: 'Prices and reorder figures must be numbers', opening: 0 };
    }
    if (cost < 0 || sell < 0 || point < 0 || reorderQty < 0) {
      return { message: 'Prices and reorder figures cannot be negative', opening: 0 };
    }
    // Mirrors the server-side rule so the API is never hit with invalid data.
    if (sell > 0 && sell < cost) {
      return { message: 'Sell price cannot be below cost price', opening: 0 };
    }

    if (editing !== null) return { message: '', opening: 0 };

    const opening = parseDecimal(form.opening_quantity);
    if (opening === null || opening < 0) {
      return { message: 'Opening quantity must be a positive number', opening: 0 };
    }
    if (opening > 0 && form.opening_location_id === '') {
      return { message: 'Choose a location for the opening stock', opening: 0 };
    }
    return { message: '', opening };
  }

  async function submit() {
    const check = validate();
    if (check === null || check.message !== '') {
      if (check !== null) setError(check.message);
      return;
    }

    const cost = parseDecimal(form.cost_price) ?? 0;
    const sell = parseDecimal(form.sell_price) ?? 0;
    const point = parseDecimal(form.reorder_point) ?? 0;
    const reorderQty = parseDecimal(form.reorder_qty) ?? 0;

    const body = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      barcode: optional(form.barcode),
      description: optional(form.description),
      category_id: form.category_id === '' ? null : form.category_id,
      supplier_id: form.supplier_id === '' ? null : form.supplier_id,
      unit: form.unit,
      cost_price: String(cost),
      sell_price: String(sell),
      reorder_point: String(point),
      reorder_qty: String(reorderQty),
      track_serial: form.track_serial,
      track_batch: form.track_batch,
    };

    setBusy(true);
    setError(null);
    try {
      if (editing === null) {
        await api<Product>('/api/products', {
          method: 'POST',
          body: {
            ...body,
            // Opening stock is written through the ledger, never into stock_levels.
            opening_quantity: String(check.opening),
            opening_location_id:
              form.opening_location_id === '' ? null : form.opening_location_id,
          },
        });
        toast.push(`Created product ${body.sku}`);
      } else {
        await api<Product>(`/api/products/${editing.id}`, { method: 'PATCH', body });
        toast.push(`Updated ${body.sku}`);
      }
      setForm(EMPTY_PRODUCT);
      onCancelEdit();
      onSaved();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Could not save the product';
      setError(message);
      toast.push(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection
      title="Products"
      editing={editing === null ? null : { label: editing.name }}
      createLabel="Add product"
    >
      <ProductFields
        form={form}
        editing={editing !== null}
        categories={categories}
        suppliers={suppliers}
        locations={locations}
        update={update}
      />

      <label className="flex items-center gap-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          checked={form.track_serial}
          onChange={(event) => update('track_serial', event.target.checked)}
        />
        Track serial numbers
      </label>
      <label className="flex items-center gap-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          checked={form.track_batch}
          onChange={(event) => update('track_batch', event.target.checked)}
        />
        Track batches — recorded on the product, but not yet enforced when recording movements
      </label>

      <FormError message={error} />

      <FormActions
        editing={editing !== null}
        busy={busy}
        submitLabel="Add product"
        onSubmit={() => void submit()}
        onCancelEdit={onCancelEdit}
      />
    </FormSection>
  );
}