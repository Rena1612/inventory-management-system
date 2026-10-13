'use client';

import type { Category, Location, Supplier } from '@/lib/types';
import { Field, fieldClass } from '@/components/form/Primitives';

export interface ProductFormState {
  sku: string;
  name: string;
  barcode: string;
  description: string;
  category_id: string;
  supplier_id: string;
  unit: string;
  cost_price: string;
  sell_price: string;
  reorder_point: string;
  reorder_qty: string;
  track_serial: boolean;
  track_batch: boolean;
  opening_quantity: string;
  opening_location_id: string;
}

export const EMPTY_PRODUCT: ProductFormState = {
  sku: '',
  name: '',
  barcode: '',
  description: '',
  category_id: '',
  supplier_id: '',
  unit: 'each',
  cost_price: '0',
  sell_price: '0',
  reorder_point: '0',
  reorder_qty: '0',
  track_serial: false,
  track_batch: false,
  opening_quantity: '',
  opening_location_id: '',
};

export function productToState(product: {
  sku: string;
  name: string;
  barcode: string | null;
  description: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string;
  cost_price: string;
  sell_price: string;
  reorder_point: string;
  reorder_qty: string;
  track_serial: boolean;
  track_batch: boolean;
}): ProductFormState {
  return {
    sku: product.sku,
    name: product.name,
    barcode: product.barcode ?? '',
    description: product.description ?? '',
    category_id: product.category_id ?? '',
    supplier_id: product.supplier_id ?? '',
    unit: product.unit,
    cost_price: product.cost_price,
    sell_price: product.sell_price,
    reorder_point: product.reorder_point,
    reorder_qty: product.reorder_qty,
    track_serial: product.track_serial,
    track_batch: product.track_batch,
    // Opening stock is only settable at creation; afterwards it moves via the ledger.
    opening_quantity: '',
    opening_location_id: '',
  };
}

const UNITS = ['each', 'box', 'case', 'pallet', 'kg', 'litre', 'metre'] as const;

interface Props {
  form: ProductFormState;
  editing: boolean;
  categories: Category[];
  suppliers: Supplier[];
  locations: Location[];
  update: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
}

export function ProductFields({
  form,
  editing,
  categories,
  suppliers,
  locations,
  update,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="SKU" htmlFor="product-sku">
        <input
          id="product-sku"
          value={form.sku}
          onChange={(event) => update('sku', event.target.value)}
          placeholder="WID-001"
          className={fieldClass}
        />
      </Field>

      <Field label="Name" htmlFor="product-name">
        <input
          id="product-name"
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          placeholder="Widget A"
          className={fieldClass}
        />
      </Field>

      <Field label="Barcode" htmlFor="product-barcode">
        <input
          id="product-barcode"
          value={form.barcode}
          onChange={(event) => update('barcode', event.target.value)}
          placeholder="9312345678907"
          className={fieldClass}
        />
      </Field>

      <Field label="Category" htmlFor="product-category">
        <select
          id="product-category"
          value={form.category_id}
          onChange={(event) => update('category_id', event.target.value)}
          className={fieldClass}
        >
          <option value="">None</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Supplier" htmlFor="product-supplier">
        <select
          id="product-supplier"
          value={form.supplier_id}
          onChange={(event) => update('supplier_id', event.target.value)}
          className={fieldClass}
        >
          <option value="">None</option>
          {suppliers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Unit" htmlFor="product-unit">
        <select
          id="product-unit"
          value={form.unit}
          onChange={(event) => update('unit', event.target.value)}
          className={fieldClass}
        >
          {UNITS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Field>

      <NumberField
        id="product-cost"
        label="Cost price"
        value={form.cost_price}
        onChange={(value) => update('cost_price', value)}
      />
      <NumberField
        id="product-sell"
        label="Sell price"
        value={form.sell_price}
        onChange={(value) => update('sell_price', value)}
      />
      <NumberField
        id="product-reorder-point"
        label="Reorder point"
        value={form.reorder_point}
        onChange={(value) => update('reorder_point', value)}
      />
      <NumberField
        id="product-reorder-qty"
        label="Reorder quantity"
        value={form.reorder_qty}
        onChange={(value) => update('reorder_qty', value)}
      />

      {!editing && (
        <>
          <Field label="Opening quantity" htmlFor="product-opening-qty">
            <input
              id="product-opening-qty"
              inputMode="decimal"
              value={form.opening_quantity}
              onChange={(event) => update('opening_quantity', event.target.value)}
              placeholder="0"
              className={fieldClass}
            />
          </Field>
          <Field label="Opening location" htmlFor="product-opening-location">
            <select
              id="product-opening-location"
              value={form.opening_location_id}
              onChange={(event) => update('opening_location_id', event.target.value)}
              className={fieldClass}
            >
              <option value="">None</option>
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      <div className="md:col-span-3">
        <Field label="Description" htmlFor="product-description">
          <textarea
            id="product-description"
            rows={2}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </Field>
  );
}