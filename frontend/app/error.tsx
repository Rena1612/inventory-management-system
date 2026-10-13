'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/Notice';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Catches a render-time throw below this point and offers a way out without a
 * full reload, so one bad row cannot take the whole app down.
 *
 * Most failures here are data-shaped — a field the API added that this build
 * does not know how to render — and those are exactly the cases a bare
 * `window.location.reload()` cannot fix, so the digest is surfaced for support.
 */
export default function RouteError({ error, reset }: Props) {
  useEffect(() => {
    console.error('route error', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-3 py-12">
      <h1 className="text-[15px] font-semibold text-ink">This screen could not be displayed</h1>
      <ErrorNote>
        {error.message || 'Something in the page data was not understood.'}
      </ErrorNote>
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
      </div>
      {error.digest !== undefined && (
        <p className="ref">Reference {error.digest}</p>
      )}
    </div>
  );
}