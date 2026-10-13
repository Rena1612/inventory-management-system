'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { ApiError, api } from '@/lib/api';
import { resolveScan } from '@/lib/scan';
import type { Location, Page, Product, ProductDetail } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FormError } from '@/components/form/Primitives';
import {
  MOVEMENT_MODES,
  MovementFields,
  type MovementMode,
} from '@/components/movements/MovementFields';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';

interface Props {
  /** Called after a successful write so the list can refresh. */
  onRecorded: () => void;
}

export function MovementForm({ onRecorded }: Props) {
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [mode, setMode] = useState<MovementMode>('in');
  const radios = useRef<Array<HTMLInputElement | null>>([]);
  const [scan, setScan] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [locationId, setLocationId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const [onHand, setOnHand] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [p, l] = await Promise.all([
          api<Page<Product>>('/api/products', { query: { limit: 200 } }),
          api<Page<Location>>('/api/locations', { query: { limit: 200 } }),
        ]);
        setProducts(p.items);
        setLocations(l.items);
        setLocationId((current) => current || l.items[0]?.id || '');
      } catch {
        // The list below the form reports load failures in its own way.
      }
    })();
  }, []);

  // Show what is on hand at the chosen location before the user commits.
  useEffect(() => {
    if (product === null || locationId === '') {
      setOnHand(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const detail = await api<ProductDetail>(`/api/products/${product.id}`);
        if (!active) return;
        const level = detail.stock.find((row) => row.location_id === locationId);
        setOnHand(level ? level.quantity : '0');
      } catch {
        if (active) setOnHand(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [product, locationId]);

  const onScanSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (scan.trim() === '') return;
      setError(null);
      try {
        const found = await resolveScan(scan);
        if (found === null) {
          setError(`No product matches "${scan.trim()}"`);
          return;
        }
        setProduct(found);
        setScan('');
        setQuantity('');
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Lookup failed');
      }
    },
    [scan],
  );

  function locationName(id: string): string {
    return locations.find((location) => location.id === id)?.name ?? 'destination';
  }

  async function submit() {
    if (product === null || locationId === '' || quantity.trim() === '') {
      setError('Pick a product, a location and a quantity');
      return;
    }
    if (mode === 'transfer' && destinationId === '') {
      setError('Choose a destination location');
      return;
    }
    if (mode === 'transfer' && destinationId === locationId) {
      setError('Source and destination must differ');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === 'transfer') {
        await api('/api/movements/transfer', {
          method: 'POST',
          body: {
            product_id: product.id,
            from_location_id: locationId,
            to_location_id: destinationId,
            quantity: quantity.trim(),
            reference: reference.trim() || null,
            note: note.trim() || null,
          },
        });
        toast.push(`Moved ${quantity} of ${product.sku} to ${locationName(destinationId)}`);
      } else {
        await api('/api/movements', {
          method: 'POST',
          body: {
            product_id: product.id,
            location_id: locationId,
            type: mode,
            quantity: quantity.trim(),
            reference: reference.trim() || null,
            note: note.trim() || null,
          },
        });
        toast.push(`Recorded ${mode} of ${quantity} for ${product.sku}`);
      }

      // Keep the location and product for rapid repeat entries; clear the rest.
      setQuantity('');
      setReference('');
      setNote('');
      onRecorded();
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : 'Could not record the movement';
      setError(message);
      toast.push(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="print:hidden space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="section-head">Record movement</h2>
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Movement type</legend>
          <div
            role="radiogroup"
            aria-label="Movement type"
            className="flex flex-wrap gap-1"
            onKeyDown={(event) => {
              // Arrow keys move and select, matching native radio behaviour.
              const step =
                event.key === 'ArrowRight' || event.key === 'ArrowDown'
                  ? 1
                  : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                    ? -1
                    : 0;
              if (step === 0) return;
              event.preventDefault();
              const current = MOVEMENT_MODES.findIndex((option) => option.value === mode);
              const next =
                (current + step + MOVEMENT_MODES.length) % MOVEMENT_MODES.length;
              const target = MOVEMENT_MODES[next];
              if (target === undefined) return;
              setMode(target.value);
              radios.current[next]?.focus();
            }}
          >
            {MOVEMENT_MODES.map((option, index) => {
              const selected = mode === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded border px-2.5 text-[13px] transition-colors',
                    // Selected differs by weight and fill, not only by hue, so the
                    // state survives greyscale and colour-blind viewing.
                    selected
                      ? 'border-ink bg-ink font-semibold text-white'
                      : 'border-line bg-surface font-normal text-ink-2 hover:bg-sunk hover:text-ink',
                  )}
                >
                  <input
                    ref={(node) => {
                      radios.current[index] = node;
                    }}
                    type="radio"
                    name="movement-mode"
                    value={option.value}
                    checked={selected}
                    onChange={() => setMode(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MovementFields
          mode={mode}
          scan={scan}
          products={products}
          locations={locations}
          product={product}
          locationId={locationId}
          destinationId={destinationId}
          quantity={quantity}
          reference={reference}
          note={note}
          onHand={onHand}
          onScanChange={setScan}
          onScanSubmit={(event) => void onScanSubmit(event)}
          onProductChange={(value) =>
            setProduct(products.find((item) => item.id === value) ?? null)
          }
          onLocationChange={setLocationId}
          onDestinationChange={setDestinationId}
          onQuantityChange={setQuantity}
          onReferenceChange={setReference}
          onNoteChange={setNote}
        />
      </div>

      <FormError message={error} />

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Recording…' : 'Record movement'}
        </Button>
        {product !== null && (
          <span className="text-[13px] text-ink-2">
            <span className="ref">{product.sku}</span> {product.name}
          </span>
        )}
      </div>
    </Panel>
  );
}