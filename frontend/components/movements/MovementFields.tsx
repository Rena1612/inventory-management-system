'use client';

import type { FormEvent } from 'react';

import { formatQuantity } from '@/lib/format';
import type { Location, Product } from '@/lib/types';
import { Field, fieldClass } from '@/components/form/Primitives';

export type MovementMode = 'in' | 'out' | 'adjust' | 'transfer';

export const MOVEMENT_MODES: ReadonlyArray<{ value: MovementMode; label: string }> = [
  { value: 'in', label: 'Stock in' },
  { value: 'out', label: 'Stock out' },
  { value: 'adjust', label: 'Adjust' },
  { value: 'transfer', label: 'Transfer' },
];

export interface MovementFieldsProps {
  mode: MovementMode;
  scan: string;
  products: Product[];
  locations: Location[];
  product: Product | null;
  locationId: string;
  destinationId: string;
  quantity: string;
  reference: string;
  note: string;
  onHand: string | null;
  onScanChange: (value: string) => void;
  onScanSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onProductChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onNoteChange: (value: string) => void;
}

export function MovementFields({
  mode,
  scan,
  products,
  locations,
  product,
  locationId,
  destinationId,
  quantity,
  reference,
  note,
  onHand,
  onScanChange,
  onScanSubmit,
  onProductChange,
  onLocationChange,
  onDestinationChange,
  onQuantityChange,
  onReferenceChange,
  onNoteChange,
}: MovementFieldsProps) {
  const destinations = locations.filter((location) => location.id !== locationId);

  return (
    <>
      <form onSubmit={onScanSubmit} className="md:col-span-2">
        <label htmlFor="scan" className="text-sm font-medium">
          Scan barcode or enter SKU
        </label>
        <input
          id="scan"
          value={scan}
          onChange={(event) => onScanChange(event.target.value)}
          placeholder="Scanner input lands here — press Enter"
          autoFocus
          className={fieldClass}
        />
      </form>

      <Field label="Product" htmlFor="product">
        <select
          id="product"
          value={product?.id ?? ''}
          onChange={(event) => onProductChange(event.target.value)}
          className={fieldClass}
        >
          <option value="">Select a product…</option>
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.sku} — {item.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={mode === 'transfer' ? 'From location' : 'Location'} htmlFor="location">
        <select
          id="location"
          value={locationId}
          onChange={(event) => onLocationChange(event.target.value)}
          className={fieldClass}
        >
          <option value="">Select a location…</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        {onHand !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            On hand here:{' '}
            <span className="font-medium">{formatQuantity(onHand)}</span>
          </p>
        )}
      </Field>

      {mode === 'transfer' && (
        <Field label="To location" htmlFor="destination">
          <select
            id="destination"
            value={destinationId}
            onChange={(event) => onDestinationChange(event.target.value)}
            className={fieldClass}
          >
            <option value="">Select a destination…</option>
            {destinations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="Quantity"
        htmlFor="quantity"
        {...(mode === 'adjust' ? { hint: 'Negative reduces stock' } : {})}
      >
        <input
          id="quantity"
          value={quantity}
          onChange={(event) => onQuantityChange(event.target.value)}
          inputMode="decimal"
          className={fieldClass}
        />
      </Field>

      <Field label="Reference" htmlFor="reference">
        <input
          id="reference"
          value={reference}
          onChange={(event) => onReferenceChange(event.target.value)}
          placeholder="PO number, ticket…"
          className={fieldClass}
        />
      </Field>

      <div className="md:col-span-2">
        <Field label="Note" htmlFor="note">
          <input
            id="note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>
    </>
  );
}