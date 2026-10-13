'use client';

import { formatQuantity } from '@/lib/format';
import type { PurchaseOrderItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  item: PurchaseOrderItem;
  remaining: number;
  inputValue: string;
  onChange: (value: string) => void;
}

export function ReceiveLine({ item, remaining, inputValue, onChange }: Props) {
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <span className="col-span-4 truncate text-[13px]">
        <span className="ref">{item.product_sku}</span> {item.product_name}
      </span>
      <span className="num col-span-2 text-[13px] text-ink-2">
        {formatQuantity(item.quantity)}
      </span>
      <span className="num col-span-2 text-[13px] text-ink-2">
        {formatQuantity(item.received_qty)}
      </span>
      <span
        className={cn(
          'num col-span-2 text-[13px]',
          remaining > 0 ? 'font-medium text-ink' : 'text-ink-2',
        )}
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
          className="field col-span-2 min-w-0 text-right"
        />
      ) : (
        // A fully received line gets no input at all — nothing left to enter.
        <span className="col-span-2 text-right text-[13px] text-ink-3">Complete</span>
      )}
    </div>
  );
}