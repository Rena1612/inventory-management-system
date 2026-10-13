import { describe, expect, it } from 'vitest';

import { ApiError, isRetryable, parseRetryAfter } from './api';

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-03-01T12:00:00Z');

  it('reads a delay in seconds', () => {
    expect(parseRetryAfter('30', now)).toBe(30_000);
    expect(parseRetryAfter('0.5', now)).toBe(500);
  });

  it('reads an HTTP date', () => {
    expect(parseRetryAfter('Sun, 01 Mar 2026 12:00:20 GMT', now)).toBe(20_000);
  });

  it('never returns a negative wait for a date already in the past', () => {
    expect(parseRetryAfter('Sun, 01 Mar 2026 11:59:00 GMT', now)).toBe(0);
  });

  it('ignores a missing or unparseable header rather than guessing', () => {
    expect(parseRetryAfter(null, now)).toBeUndefined();
    expect(parseRetryAfter('', now)).toBeUndefined();
    expect(parseRetryAfter('   ', now)).toBeUndefined();
    expect(parseRetryAfter('soon', now)).toBeUndefined();
  });
});

describe('ApiError carries the server delay', () => {
  it('passes retryAfterMs through from the header', () => {
    const error = new ApiError({ error: 'slow down', code: 'RATE_LIMITED' }, 429, 30_000);
    expect(error.retryAfterMs).toBe(30_000);
  });

  it('leaves it undefined when the server sent no header', () => {
    const error = new ApiError({ error: 'boom', code: 'X' }, 429);
    expect(error.retryAfterMs).toBeUndefined();
  });
});

describe('isRetryable', () => {
  const err = (status: number, retryAfterMs?: number) =>
    new ApiError({ error: 'x', code: 'X' }, status, retryAfterMs);

  it('offers a retry for transient failures', () => {
    expect(isRetryable(err(429))).toBe(true);
    expect(isRetryable(err(500))).toBe(true);
    expect(isRetryable(err(503))).toBe(true);
    expect(isRetryable(err(408))).toBe(true);
  });

  it('offers no retry where repeating the request cannot help', () => {
    expect(isRetryable(err(403))).toBe(false);
    expect(isRetryable(err(404))).toBe(false);
    expect(isRetryable(err(400))).toBe(false);
  });

  it('treats a transport failure as retryable', () => {
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true);
  });
});