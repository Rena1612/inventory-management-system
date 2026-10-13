'use client';

import { formatQuantity } from '@/lib/format';
import type { PurchaseOrderItem } from '@/lib/types';

interface Props {
  item: PurchaseOrderItem;
  remaining: number;
  inputValue: string;
  onChange: (value: string) => void;
}

export function ReceiveLine({ item, remaining, inputValue, onChange }: Props) {
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <span className="col-span-4 truncate text-sm">
        {item.product_sku} — {item.product_name}
      </span>
      <span className="col-span-2 text-right text-sm text-muted-foreground">
        {formatQuantity(item.quantity)}
      </span>
      <span className="col-span-2 text-right text-sm text-muted-foreground">
        {formatQuantity(item.received_qty)}
      </span>
      <span
        className={`col-span-2 text-right text-sm ${
          remaining > 0 ? 'font-medium' : 'text-muted-foreground'
        }`}
      >
        {formatQuantity(String(remaining))}
      </span>
      {remaining > 0 ? (
        <input
          aria-label={`Receive for ${item.product_sku}`}
          inputMode="decimal"
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className="col-span-2 rounded-md border px-3 py-2 text-sm"
        />
      ) : (
        // A fully received line gets no input at all — nothing left to enter.
        <span className="col-span-2 text-right text-sm text-muted-foreground">Complete</span>
      )}
    </div>
  );
}