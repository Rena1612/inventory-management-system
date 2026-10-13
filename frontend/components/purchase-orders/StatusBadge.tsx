'use client';

import type { PoStatus } from '@/lib/types';

const TONE: Record<PoStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-secondary text-secondary-foreground',
  partial: 'bg-amber-100 text-amber-900',
  received: 'bg-emerald-100 text-emerald-900',
  cancelled: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ status }: { status: PoStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${TONE[status]}`}>{status}</span>
  );
}