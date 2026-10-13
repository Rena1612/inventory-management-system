'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { SectionHead } from '@/components/ui/PageHeader';

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
  return <ErrorNote>{message}</ErrorNote>;
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
      <Button variant="primary" onClick={onSubmit} disabled={busy}>
        {busy ? 'Saving…' : editing ? 'Save changes' : submitLabel}
      </Button>
      {editing && <Button onClick={onCancelEdit}>Cancel</Button>}
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
    <Panel className="space-y-3 p-4 print:hidden">
      <SectionHead aside={title}>
        {editing === null ? createLabel : `Edit ${editing.label}`}
      </SectionHead>
      {children}
    </Panel>
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