'use client';

import type { PoStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Purchase-order state is a workflow position, not a stock level, so it gets no
 * colour — colour is reserved for shortfalls. The lifecycle reads through weight
 * instead: quiet for draft and cancelled, filled for the terminal "received".
 */
const TONE: Record<PoStatus, string> = {
  draft: 'border-line bg-surface text-ink-3',
  open: 'border-line bg-surface text-ink-2',
  partial: 'border-line bg-sunk text-ink-2',
  received: 'border-ink bg-ink text-white',
  cancelled: 'border-line bg-surface text-ink-3 line-through',
};

const LABEL: Record<PoStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  partial: 'Partly received',
  received: 'Received',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: { status: PoStatus }) {
  return (
    <span className={cn('inline-block rounded border px-1.5 py-px text-[11px]', TONE[status])}>
      {LABEL[status]}
    </span>
  );
}