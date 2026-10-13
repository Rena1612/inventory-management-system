'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { api, isRetryable } from '@/lib/api';
import type { Page } from '@/lib/types';

export interface ListQuery {
  [key: string]: string | number | boolean | undefined;
}

export interface UseListPageOptions {
  path: string;
  pageSize?: number;
  /** Extra query params, e.g. { q: search, type: movementType }. */
  query?: ListQuery;
  /** Skip fetching entirely (e.g. a dependent picker with nothing selected yet). */
  enabled?: boolean;
}

export interface UseListPageResult<T> {
  items: T[];
  /** `meta.total`, not `items.length` — the two differ on every page but the last. */
  total: number;
  loading: boolean;
  error: unknown;
  /** Consecutive failed loads. Survives the error UI unmounting, so PageError can hold a cooldown. */
  failedAttempts: number;
  offset: number;
  page: number;
  pageCount: number;
  canPrevious: boolean;
  canNext: boolean;
  setOffset: (offset: number) => void;
  next: () => void;
  previous: () => void;
  reload: () => Promise<void>;
}

function isAbort(caught: unknown): boolean {
  return caught instanceof Error && caught.name === 'AbortError';
}

/**
 * List-page data loading: sequencing, pagination and error bookkeeping in one
 * place, so a new list page cannot ship without them.
 *
 * Two independent guards, because either alone is insufficient:
 *  - an AbortController cancels the superseded request, which saves the work;
 *  - a monotonic sequence number drops any response that is no longer the
 *    newest, which still holds if the abort loses the race or a response had
 *    already resolved when the abort was issued.
 *
 * Rows from the last successful load are kept while refetching, so changing a
 * filter does not blank the table, and a failed refetch does not destroy data
 * that is already on screen.
 */
export function useListPage<T>({
  path,
  pageSize = 20,
  query,
  enabled = true,
}: UseListPageOptions): UseListPageResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [offset, setOffset] = useState(0);

  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Serialised so a fresh object literal each render is not a new dependency.
  const queryKey = JSON.stringify(query ?? {});

  const load = useCallback(async () => {
    if (!enabled) return;

    const mine = ++seq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const result = await api<Page<T>>(path, {
        query: { ...(JSON.parse(queryKey) as ListQuery), limit: pageSize, offset },
        signal: controller.signal,
      });
      if (mine !== seq.current) return;
      setItems(result.items);
      setTotal(result.meta.total);
      setError(null);
      setFailedAttempts(0);
    } catch (caught) {
      // A superseded request is not a failure and must not raise the counter.
      if (mine !== seq.current || isAbort(caught)) return;
      setError(caught);
      setFailedAttempts((count) => (isRetryable(caught) ? count + 1 : 0));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path, pageSize, offset, queryKey, enabled]);

  useEffect(() => {
    void load();
    // Cancel anything still in flight when the component unmounts.
    return () => abortRef.current?.abort();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.floor(offset / pageSize) + 1;

  return {
    items,
    total,
    loading,
    error,
    failedAttempts,
    offset,
    page,
    pageCount,
    canPrevious: offset > 0,
    canNext: offset + items.length < total,
    setOffset: (next) => {
      setOffset(Math.max(0, next));
    },
    next: () => setOffset((current) => Math.min(current + pageSize, Math.max(0, total - 1))),
    previous: () => setOffset((current) => Math.max(0, current - pageSize)),
    reload: load,
  };
}