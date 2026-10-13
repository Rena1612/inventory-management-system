import { cn } from '@/lib/utils';

export type StockLevel = 'ok' | 'low' | 'out';

/**
 * One rule decides every stock colour in the product: healthy stock is drawn in
 * neutral ink, so saturation is only ever spent on a shortfall.
 */
export function stockLevel(quantity: number, reorderPoint: number): StockLevel {
  if (quantity <= 0) return 'out';
  if (reorderPoint > 0 && quantity <= reorderPoint) return 'low';
  return 'ok';
}

const FILL: Record<StockLevel, string> = {
  ok: 'bg-ink-3',
  low: 'bg-stock-low',
  out: 'bg-stock-out',
};

const TEXT: Record<StockLevel, string> = {
  ok: 'text-ink',
  low: 'text-stock-low',
  out: 'text-stock-out',
};

const WORD: Record<StockLevel, string> = {
  ok: 'In stock',
  low: 'Low',
  out: 'Out',
};

/**
 * Spoken form. Leads with the status, because colour — and the hidden slot of a
 * healthy row — carry nothing to a screen reader.
 */
const SPEECH: Record<StockLevel, string> = {
  ok: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
};

interface Props {
  quantity: number;
  reorderPoint: number;
  reorderQty: number;
  /** Formatted on-hand figure, so units and separators stay consistent. */
  label: string;
  unit?: string;
  className?: string;
}

/**
 * Coverage of the reorder band. The track spans reorder point + reorder qty, and
 * the tick marks where the reorder point sits, so a row is read against its own
 * threshold rather than against the longest row on the page.
 *
 * The bar is never the only signal: the figure beside it is the text equivalent,
 * and a shortfall always carries its status word too. The status word sits after
 * the track so the bars themselves stay in a single vertical column.
 */
export function StockGauge({ quantity, reorderPoint, reorderQty, label, unit, className }: Props) {
  const level = stockLevel(quantity, reorderPoint);
  const band = reorderPoint + reorderQty > 0 ? reorderPoint + reorderQty : Math.max(quantity, 1);
  const fill = Math.max(0, Math.min(1, quantity / band));
  const tick = Math.max(0, Math.min(1, reorderPoint / band));
  const suffix = unit === undefined ? '' : ` ${unit}`;

  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      <span className={cn('w-16 shrink-0 text-right text-[12px] tabular-nums', TEXT[level])}>
        {label}
      </span>

      <div
        role="meter"
        aria-label="Stock on hand"
        aria-valuenow={quantity}
        aria-valuemin={0}
        aria-valuemax={Math.max(band, quantity)}
        aria-valuetext={`${SPEECH[level]}: ${label}${suffix} on hand, reorder point ${reorderPoint}`}
        className="relative h-1.5 w-16 shrink-0 border border-line bg-sunk"
      >
        <div className={cn('h-full', FILL[level])} style={{ width: `${fill * 100}%` }} />
        {/* The halo keeps the threshold mark legible over both the fill and the empty track. */}
        <div
          aria-hidden
          className="absolute -top-px -bottom-px w-px bg-ink"
          style={{ left: `${tick * 100}%`, boxShadow: '0 0 0 1px var(--surface)' }}
        />
      </div>

      {/* Reserve the slot even when healthy so the tracks stay in one column. */}
      <span className={cn('w-7 shrink-0 text-[11px]', TEXT[level], level === 'ok' && 'invisible')}>
        {WORD[level]}
      </span>
    </div>
  );
}