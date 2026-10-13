import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Align = 'left' | 'right';

/** Dense data table: 13px, 1px rules, tabular figures, no zebra. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn('table', className)}>{children}</table>;
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: Align;
  className?: string;
}) {
  return (
    <th scope="col" className={cn('th', align === 'right' && 'text-right', className)}>
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: Align;
  className?: string;
}) {
  return (
    <td className={cn('td', align === 'right' && 'num', className)}>{children}</td>
  );
}

/**
 * Fills the frame when there is nothing to list, so the page does not collapse
 * and shift under the reader. Pass an action to turn the gap into a prompt.
 */
export function TableNote({
  colSpan,
  children,
  className,
}: {
  colSpan: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn('td py-8 text-center text-ink-3', className)}>
        {children}
      </td>
    </tr>
  );
}

/** Keeps column widths steady while a page of rows is in flight. */
export function TablePending({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="td py-8 text-center text-ink-3">
        Loading…
      </td>
    </tr>
  );
}