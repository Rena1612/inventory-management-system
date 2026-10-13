'use client';

import type { ReactNode } from 'react';

/** Shared field styling, matching the movement form. */
export const fieldClass = 'field mt-1';

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint !== undefined && <p className="mt-1 text-[11px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p role="alert" className="border border-stock-out bg-stock-out-bg px-3 py-2 text-[13px] text-stock-out">
      {message}
    </p>
  );
}

interface ActionsProps {
  editing: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancelEdit: () => void;
}

export function FormActions({ editing, busy, submitLabel, onSubmit, onCancelEdit }: ActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className="btn-primary"
      >
        {busy ? 'Saving…' : editing ? 'Save changes' : submitLabel}
      </button>
      {editing && (
        <button
          type="button"
          onClick={onCancelEdit}
          className="btn-ghost"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  editing: { label: string } | null;
  createLabel: string;
  children: ReactNode;
}

/** Consistent card wrapper for every create/edit form on a list page. */
export function FormSection({ title, editing, createLabel, children }: SectionProps) {
  return (
    <section className="panel print:hidden space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="section-head">{editing === null ? createLabel : `Edit ${editing.label}`}</h2>
        <span className="text-[11px] text-ink-3">{title}</span>
      </div>
      {children}
    </section>
  );
}

/**
 * Parse a decimal field. Returns null when the value is not a finite number,
 * so callers can surface a field-level message instead of sending NaN.
 */
export function parseDecimal(value: string): number | null {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}