import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PanelProps {
  children: ReactNode;
  /** Wide tables scroll inside the frame instead of pushing the page sideways. */
  scroll?: boolean;
  className?: string;
}

/** Hairline-bordered surface. The one container every screen builds from. */
export function Panel({ children, scroll = false, className }: PanelProps) {
  return <div className={cn('panel', scroll && 'overflow-x-auto', className)}>{children}</div>;
}

interface FigureStripProps {
  children: ReactNode;
  className?: string;
}

/** Row of headline figures with dividers. Replaces the card grid. */
export function FigureStrip({ children, className }: FigureStripProps) {
  return <section className={cn('panel flex flex-wrap divide-x divide-line', className)}>{children}</section>;
}

interface FigureProps {
  label: string;
  value: string;
  className?: string;
}

export function Figure({ label, value, className }: FigureProps) {
  return (
    <div className={cn('min-w-48 flex-1 px-4 py-3', className)}>
      <p className="text-[11px] text-ink-3">{label}</p>
      <p className="num mt-0.5 text-[17px] font-medium text-ink">{value}</p>
    </div>
  );
}