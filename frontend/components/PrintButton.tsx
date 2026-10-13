'use client';

import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';

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
        <h1 className="text-[15px] font-semibold text-ink">{title}</h1>
        {organizationName !== null && organizationName !== undefined && (
          <p className="text-[11px] text-ink-2">{organizationName}</p>
        )}
        <p className="text-[11px] text-ink-2">
          Generated {formatDateTime(generatedAt ?? null)}
        </p>
        <hr className="my-3" />
      </div>

      <Button className="print:hidden" onClick={() => window.print()}>
        Print / Save as PDF
      </Button>
    </>
  );
}