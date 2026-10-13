'use client';

import { useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { Category } from '@/lib/types';
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
  editing: Category | null;
  categories: Category[];
  onCancelEdit: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  parent_id: string;
}

const EMPTY: FormState = { name: '', description: '', parent_id: '' };

function fromCategory(category: Category): FormState {
  return {
    name: category.name,
    description: category.description ?? '',
    parent_id: category.parent_id ?? '',
  };
}

export function CategoryForm({ editing, categories, onCancelEdit, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(editing === null ? EMPTY : fromCategory(editing));
    setError(null);
  }, [editing]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const parentOptions = categories.filter((item) => item.id !== editing?.id);

  async function submit() {
    if (form.name.trim() === '') {
      setError('Name is required');
      return;
    }
    if (form.parent_id !== '' && form.parent_id === editing?.id) {
      setError('A category cannot be its own parent');
      return;
    }

    const body = {
      name: form.name.trim(),
      description: optional(form.description),
      parent_id: form.parent_id === '' ? null : form.parent_id,
    };

    setBusy(true);
    setError(null);
    try {
      if (editing === null) {
        await api<Category>('/api/categories', { method: 'POST', body });
        toast.push(`Created category ${body.name}`);
      } else {
        await api<Category>(`/api/categories/${editing.id}`, { method: 'PATCH', body });
        toast.push(`Updated ${body.name}`);
      }
      setForm(EMPTY);
      onCancelEdit();
      onSaved();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Could not save the category';
      setError(message);
      toast.push(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection
      title="Categories"
      editing={editing === null ? null : { label: editing.name }}
      createLabel="Add category"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="category-name">
          <input
            id="category-name"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Hardware"
            className={fieldClass}
          />
        </Field>

        <Field label="Parent" htmlFor="category-parent" hint="Optional — nests this under another category">
          <select
            id="category-parent"
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
          <Field label="Description" htmlFor="category-description">
            <textarea
              id="category-description"
              rows={2}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
      </div>

      <FormError message={error} />

      <FormActions
        editing={editing !== null}
        busy={busy}
        submitLabel="Add category"
        onSubmit={() => void submit()}
        onCancelEdit={onCancelEdit}
      />
    </FormSection>
  );
}