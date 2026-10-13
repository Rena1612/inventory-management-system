'use client';

import { formatMoney } from '@/lib/format';
import type { Location, Product } from '@/lib/types';

export interface LineState {
  key: number;
  product_id: string;
  quantity: string;
  unit_cost: string;
  location_id: string;
}

let nextKey = 0;

export function newLine(): LineState {
  nextKey += 1;
  return { key: nextKey, product_id: '', quantity: '', unit_cost: '', location_id: '' };
}

interface Props {
  lines: LineState[];
  products: Product[];
  locations: Location[];
  total: number;
  onChange: (lines: LineState[]) => void;
}

/** Editable line grid for a purchase order. */
export function PurchaseOrderLines({
  lines,
  products,
  locations,
  total,
  onChange,
}: Props) {
  function patch(key: number, changes: Partial<Omit<LineState, 'key'>>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  /** Choosing a product seeds the unit cost from the product's own cost price. */
  function chooseProduct(key: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    patch(key, {
      product_id: productId,
      unit_cost: product && product.cost_price !== '0' ? product.cost_price : '',
    });
  }

  function remove(key: number) {
    onChange(lines.length === 1 ? [newLine()] : lines.filter((line) => line.key !== key));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="col-span-4">Product</span>
        <span className="col-span-2">Quantity</span>
        <span className="col-span-2">Unit cost</span>
        <span className="col-span-3">Destination</span>
        <span className="col-span-1" />
      </div>

      {lines.map((line) => (
        <div key={line.key} className="grid grid-cols-12 items-center gap-2">
          <select
            aria-label="Product"
            value={line.product_id}
            onChange={(event) => chooseProduct(line.key, event.target.value)}
            className="col-span-4 rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select a product…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.name}
              </option>
            ))}
          </select>

          <input
            aria-label="Quantity"
            inputMode="decimal"
            value={line.quantity}
            onChange={(event) => patch(line.key, { quantity: event.target.value })}
            placeholder="0"
            className="col-span-2 rounded-md border px-3 py-2 text-sm"
          />

          <input
            aria-label="Unit cost"
            inputMode="decimal"
            value={line.unit_cost}
            onChange={(event) => patch(line.key, { unit_cost: event.target.value })}
            placeholder="0.00"
            className="col-span-2 rounded-md border px-3 py-2 text-sm"
          />

          <select
            aria-label="Destination"
            value={line.location_id}
            onChange={(event) => patch(line.key, { location_id: event.target.value })}
            className="col-span-3 rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Receive later</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => remove(line.key)}
            aria-label="Remove line"
            className="col-span-1 rounded-md border px-2 py-2 text-xs text-destructive hover:bg-muted"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange([...lines, newLine()])}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Add line
        </button>
        <span className="text-sm text-muted-foreground">
          Total: <span className="font-medium">{formatMoney(String(total))}</span>
        </span>
      </div>
    </div>
  );
}