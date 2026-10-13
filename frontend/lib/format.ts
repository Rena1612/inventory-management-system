/** Decimal strings arrive from Postgres NUMERIC; render them without float drift. */

import type { MovementType } from './types';

export function formatQuantity(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (Number.isNaN(parsed)) return '0';
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatMoney(value: string | number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined) return `${currency} 0.00`;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (Number.isNaN(parsed)) return `${currency} 0.00`;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(parsed);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: 'Received',
  out: 'Issued',
  adjust: 'Adjustment',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
};

/**
 * Human label for a movement type, falling back to the raw value.
 *
 * `movement_type` is an enum, but the API is a separate deployable: a label
 * added on the backend before the frontend ships must render as itself rather
 * than as `undefined` inside a table cell.
 */
export function movementLabel(type: string): string {
  return MOVEMENT_LABEL[type as MovementType] ?? type;
}

/**
 * Effect of a movement on stock, as reported by the API in `delta`. The ledger
 * owns the sign rule; this side only formats the number it is handed.
 */
export function formatDelta(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${Math.abs(rounded).toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
}