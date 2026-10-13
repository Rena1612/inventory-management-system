'use client';

import { formatDateTime } from '@/lib/format';

interface PrintButtonProps {
  /** Printed above the report on paper. */
  title: string;
  /** ISO timestamp of when the data was fetched. */
  generatedAt?: string | null;
  organizationName?: string | null;
}

/**
 * Prints the page via the browser, which also offers "Save as PDF".
 * Uses print: variants so the surrounding chrome is dropped on paper.
 */
export function PrintButton({ title, generatedAt, organizationName }: PrintButtonProps) {
  return (
    <>
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">
          {organizationName ? `${organizationName} · ` : ''}
          Generated {formatDateTime(generatedAt ?? null)}
        </p>
        <hr className="my-3" />
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="print:hidden rounded-md border px-3 py-2 text-sm hover:bg-muted"
      >
        Print / Save as PDF
      </button>
    </>
  );
}