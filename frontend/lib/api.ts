import type { ApiErrorBody } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'inventory.token';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  /**
   * Milliseconds the server asked us to wait, from the `Retry-After` header on a
   * 429 or 503. `undefined` when the server sent no usable header.
   */
  readonly retryAfterMs: number | undefined;

  constructor(body: ApiErrorBody, status: number, retryAfterMs?: number) {
    super(body.error);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** `Retry-After` is either a delay in seconds or an HTTP date. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (header === null) return undefined;
  const trimmed = header.trim();
  if (trimmed === '') return undefined;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, at - now);
}

/**
 * Whether asking again could plausibly succeed. A 403 or 404 will fail exactly
 * the same way on every retry, so the UI explains it instead of offering one.
 * A 401 never reaches here: `api` clears the token and redirects to sign in.
 */
export function isRetryable(caught: unknown): boolean {
  if (caught instanceof ApiError) {
    return caught.status === 408 || caught.status === 429 || caught.status >= 500;
  }
  // Anything else is a transport failure (offline, DNS, aborted) — worth retrying.
  return true;
}

/** A sentence that says what went wrong, never a bare "error". */
export function describeError(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    if (caught.status === 403) return `You do not have access to this. ${caught.message}`;
    if (caught.status === 404) return `That record no longer exists. ${caught.message}`;
    return caught.message;
  }
  return fallback;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options;

  const url = new URL(path, BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let sentAuth = false;
  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      sentAuth = true;
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && sentAuth) {
    // The token expired or was revoked mid-session: drop it and send the user
    // back to sign in rather than leaving them on a dead screen.
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login?expired=1');
    }
    throw new ApiError({ error: 'Session expired', code: 'UNAUTHORIZED' }, 401);
  }

  if (!response.ok) {
    const fallback: ApiErrorBody = { error: response.statusText, code: 'UNKNOWN' };
    let parsed: ApiErrorBody = fallback;
    try {
      parsed = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error body; keep the fallback.
    }
    throw new ApiError(
      parsed,
      response.status,
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}