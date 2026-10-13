'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { ApiError, describeError, isRetryable } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/**
 * Applied after a retry that fails again, so a struggling endpoint cannot be
 * hammered. A `Retry-After` from the server always wins over this.
 */
const RETRY_COOLDOWN_MS = 5000;

/**
 * Load failure. Says what failed and what to do about it — never apologises,
 * never stays vague.
 */
export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'border border-stock-out bg-stock-out-bg px-3 py-2 text-[13px] text-stock-out',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Replaces a whole screen that has nothing to show yet. */
export function LoadingNote({
  children = 'Loading…',
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <p className={cn('text-[13px] text-ink-3', className)}>{children}</p>;
}

interface PageErrorProps {
  /** The thrown value. Supplies the message and decides whether a retry is offered. */
  error: unknown;
  /** Used when the failure was a transport fault with no message of its own. */
  fallback?: string;
  /**
   * Re-run just the fetch. Pass this whenever the page can: a full reload throws
   * away filters, a half-filled form and scroll position. Falls back to a page
   * reload only when no callback is supplied.
   */
  onRetry?: () => void | Promise<void>;
  /**
   * Consecutive failed loads, owned by whoever holds the loader.
   *
   * PageError unmounts on every retry — the loader clears the error, the page
   * shows "Loading…", and a fresh PageError mounts on failure — so a counter
   * held here would always read zero and the cooldown would never engage. Pass
   * the real count in and the cooldown survives the unmount.
   */
  failedAttempts?: number;
}

/**
 * Full-screen failure, for a page whose data never arrived.
 *
 * A retry is only offered when repeating the request could plausibly work.
 * A 403 or 404 gets a plain explanation instead — retrying those just fails
 * again and makes the page look broken.
 *
 * Retrying is rate limited: a `Retry-After` header disables the button for as
 * long as the server asked, and any retry that fails again falls back to a short
 * local cooldown.
 */
export function PageError({
  error,
  fallback = 'The request failed.',
  onRetry,
  failedAttempts = 0,
}: PageErrorProps) {
  const [pending, setPending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const seenAttempts = useRef(failedAttempts);

  const retryable = isRetryable(error);
  const serverDelay = error instanceof ApiError ? error.retryAfterMs : undefined;

  // Honour Retry-After for as long as the server asked.
  useEffect(() => {
    if (serverDelay === undefined) return;
    setCooldownUntil(Date.now() + serverDelay);
  }, [serverDelay]);

  // A retry that came back as another failure: cool the button down. Driven by
  // the caller's counter rather than local state, so it survives the unmount.
  useEffect(() => {
    if (failedAttempts > seenAttempts.current) {
      setCooldownUntil(Date.now() + RETRY_COOLDOWN_MS);
    }
    seenAttempts.current = failedAttempts;
  }, [failedAttempts]);

  const waitMs = Math.max(0, cooldownUntil - now);
  const cooling = waitMs > 0;

  // Re-render when the wait lapses so the button comes back on its own.
  useEffect(() => {
    if (!cooling) return;
    const id = setTimeout(() => setNow(Date.now()), waitMs);
    return () => clearTimeout(id);
  }, [cooling, waitMs]);

  async function runRetry() {
    if (onRetry === undefined) {
      window.location.reload();
      return;
    }
    setPending(true);
    try {
      await onRetry();
    } catch {
      // The page's loader normally records the failure itself; this only
      // catches a loader that rethrows.
    } finally {
      setPending(false);
    }
  }

  const seconds = Math.ceil(waitMs / 1000);

  return (
    <div className="space-y-3">
      <ErrorNote>{describeError(error, fallback)}</ErrorNote>
      {retryable && (
        <Button
          onClick={() => void runRetry()}
          disabled={pending || cooling}
          title={cooling ? `Retry available in ${seconds}s` : undefined}
        >
          {pending ? 'Retrying…' : cooling ? `Retry in ${seconds}s` : 'Retry'}
        </Button>
      )}
    </div>
  );
}