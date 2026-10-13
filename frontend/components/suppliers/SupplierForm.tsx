'use client';

import { useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Supplier } from '@/lib/types';
import {
  Field,
  FormActions,
  FormError,
  FormSection,
  fieldClass,
  optional,
} from '@/components/form/Primitives';
import { useToast } from '@/components/Toast';

interface Props {
  editing: Supplier | null;
  onCancelEdit: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

const EMPTY: FormState = { name: '', email: '', phone: '', address: '', notes: '' };

function fromSupplier(supplier: Supplier): FormState {
  return {
    name: supplier.name,
    email: supplier.email ?? '',
    phone: supplier.phone ?? '',
    address: supplier.address ?? '',
    notes: supplier.notes ?? '',
  };
}

export function SupplierForm({ editing, onCancelEdit, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the fields whenever the edit target changes.
  useEffect(() => {
    setForm(editing === null ? EMPTY : fromSupplier(editing));
    setError(null);
  }, [editing]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (form.name.trim() === '') {
      setError('Name is required');
      return;
    }
    // Cheap shape check so an obvious typo never costs a round trip.
    if (form.email.trim() !== '' && !form.email.includes('@')) {
      setError('Email does not look valid');
      return;
    }

    const body = {
      name: form.name.trim(),
      email: optional(form.email),
      phone: optional(form.phone),
      address: optional(form.address),
      notes: optional(form.notes),
    };

    setBusy(true);
    setError(null);
    try {
      if (editing === null) {
        await api<Supplier>('/api/suppliers', { method: 'POST', body });
        toast.push(`Created supplier ${body.name}`);
      } else {
        await api<Supplier>(`/api/suppliers/${editing.id}`, { method: 'PATCH', body });
        toast.push(`Updated ${body.name}`);
      }
      setForm(EMPTY);
      onCancelEdit();
      onSaved();
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : 'Could not save the supplier';
      setError(message);
      toast.push(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection
      title="Suppliers"
      editing={editing === null ? null : { label: editing.name }}
      createLabel="Add supplier"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="supplier-name">
          <input
            id="supplier-name"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Acme Supply"
            className={fieldClass}
          />
        </Field>

        <Field label="Email" htmlFor="supplier-email">
          <input
            id="supplier-email"
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            placeholder="sales@acme.com"
            className={fieldClass}
          />
        </Field>

        <Field label="Phone" htmlFor="supplier-phone">
          <input
            id="supplier-phone"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            placeholder="+1 555 0100"
            className={fieldClass}
          />
        </Field>

        <Field label="Address" htmlFor="supplier-address">
          <input
            id="supplier-address"
            value={form.address}
            onChange={(event) => update('address', event.target.value)}
            className={fieldClass}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Notes" htmlFor="supplier-notes">
            <textarea
              id="supplier-notes"
              rows={2}
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
      </div>

      <FormError message={error} />

      <FormActions
        editing={editing !== null}
        busy={busy}
        submitLabel="Add supplier"
        onSubmit={() => void submit()}
        onCancelEdit={onCancelEdit}
      />
    </FormSection>
  );
}