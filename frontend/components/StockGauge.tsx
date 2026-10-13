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

interface Props {
  quantity: number;
  reorderPoint: number;
  reorderQty: number;
  /** Shown beside the track; pass a formatted string so units stay consistent. */
  label: string;
  unit?: string;
  className?: string;
}

/**
 * Coverage of the reorder band. The track spans reorder point + reorder qty, and
 * the tick marks where the reorder point sits, so a row is read against its own
 * threshold rather than against the longest row on the page.
 */
export function StockGauge({ quantity, reorderPoint, reorderQty, label, unit, className }: Props) {
  const level = stockLevel(quantity, reorderPoint);
  const ceiling = reorderPoint + reorderQty > 0 ? reorderPoint + reorderQty : Math.max(quantity, 1);
  const fill = Math.max(0, Math.min(1, quantity / ceiling));
  const tick = Math.max(0, Math.min(1, reorderPoint / ceiling));

  const description =
    level === 'out'
      ? `Out of stock${unit ? ` of ${unit}` : ''}`
      : level === 'low'
        ? `Below reorder point of ${reorderPoint}${unit ? ` ${unit}` : ''}`
        : `Above reorder point of ${reorderPoint}${unit ? ` ${unit}` : ''}`;

  return (
    <div className={`flex items-center justify-end gap-2 ${className ?? ''}`}>
      <span className={`w-20 shrink-0 text-[12px] ${TEXT[level]}`}>{label}</span>
      <div
        role="img"
        aria-label={`${description}. ${label} on hand.`}
        className="relative h-1.5 w-16 shrink-0 border border-line bg-sunk"
      >
        <div className={`h-full ${FILL[level]}`} style={{ width: `${fill * 100}%` }} />
        {/* The halo keeps the threshold mark legible over both the fill and the empty track. */}
        <div
          aria-hidden
          className="absolute -top-px -bottom-px w-px bg-ink"
          style={{ left: `${tick * 100}%`, boxShadow: '0 0 0 1px var(--surface)' }}
        />
      </div>
    </div>
  );
}