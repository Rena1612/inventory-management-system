'use client';

import { useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Location } from '@/lib/types';
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
  editing: Location | null;
  locations: Location[];
  onCancelEdit: () => void;
  onSaved: () => void;
}

const TYPES = ['warehouse', 'zone', 'shelf', 'bin', 'vehicle'] as const;

interface FormState {
  name: string;
  code: string;
  type: Location['type'];
  address: string;
  parent_id: string;
}

const EMPTY: FormState = { name: '', code: '', type: 'shelf', address: '', parent_id: '' };

function fromLocation(location: Location): FormState {
  return {
    name: location.name,
    code: location.code ?? '',
    type: location.type,
    address: location.address ?? '',
    parent_id: location.parent_id ?? '',
  };
}

export function LocationForm({ editing, locations, onCancelEdit, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(editing === null ? EMPTY : fromLocation(editing));
    setError(null);
  }, [editing]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // A location cannot be its own parent.
  const parentOptions = locations.filter((item) => item.id !== editing?.id);

  async function submit() {
    if (form.name.trim() === '') {
      setError('Name is required');
      return;
    }
    if (form.parent_id !== '' && form.parent_id === editing?.id) {
      setError('A location cannot be its own parent');
      return;
    }

    const body = {
      name: form.name.trim(),
      code: optional(form.code),
      type: form.type,
      address: optional(form.address),
      parent_id: form.parent_id === '' ? null : form.parent_id,
    };

    setBusy(true);
    setError(null);
    try {
      if (editing === null) {
        await api<Location>('/api/locations', { method: 'POST', body });
        toast.push(`Created location ${body.name}`);
      } else {
        await api<Location>(`/api/locations/${editing.id}`, { method: 'PATCH', body });
        toast.push(`Updated ${body.name}`);
      }
      setForm(EMPTY);
      onCancelEdit();
      onSaved();
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : 'Could not save the location';
      setError(message);
      toast.push(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection
      title="Locations"
      editing={editing === null ? null : { label: editing.name }}
      createLabel="Add location"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="location-name">
          <input
            id="location-name"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Aisle A / Shelf 1"
            className={fieldClass}
          />
        </Field>

        <Field label="Code" htmlFor="location-code">
          <input
            id="location-code"
            value={form.code}
            onChange={(event) => update('code', event.target.value)}
            placeholder="A-1"
            className={fieldClass}
          />
        </Field>

        <Field label="Type" htmlFor="location-type">
          <select
            id="location-type"
            value={form.type}
            onChange={(event) => update('type', event.target.value as Location['type'])}
            className={fieldClass}
          >
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Parent" htmlFor="location-parent" hint="Optional — nests this under another location">
          <select
            id="location-parent"
            value={form.parent_id}
            onChange={(event) => update('parent_id', event.target.value)}
            className={fieldClass}
          >
            <option value="">None</option>
            {parentOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="md:col-span-2">
          <Field label="Address" htmlFor="location-address">
            <input
              id="location-address"
              value={form.address}
              onChange={(event) => update('address', event.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
      </div>

      <FormError message={error} />

      <FormActions
        editing={editing !== null}
        busy={busy}
        submitLabel="Add location"
        onSubmit={() => void submit()}
        onCancelEdit={onCancelEdit}
      />
    </FormSection>
  );
}