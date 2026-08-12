import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { FieldList } from './FieldList';
import { FieldModal, type FieldModalInput } from './FieldModal';
import { FormSettings, type FormSettingsPatch } from './FormSettings';
import { guardEditableField, moveId } from './logic';
import type { CfpForm, EventTrack, FormField } from './types';
import './forms.css';

interface EventSummary {
  id: string;
  slug: string;
}

type ModalState = { mode: 'create' } | { mode: 'edit'; field: FormField } | null;

/** J1 form builder SPA (DEC-033): loads the event's default CFP form and
 * renders its settings strip + ordered field list. Zero new server code —
 * every call goes through the landed w2-c forms API via api.ts. */
export function FormsPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [form, setForm] = useState<CfpForm | null>(null);
  const [tracks, setTracks] = useState<EventTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<EventSummary>(`/events/${eventId}`),
      apiGet<CfpForm>(`/events/${eventId}/forms`),
      apiList<EventTrack>(`/events/${eventId}/tracks`),
    ])
      .then(([ev, formResult, tracksResult]) => {
        setEvent(ev);
        setForm(formResult);
        setTracks(tracksResult.items);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the form'))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveSettings(patch: FormSettingsPatch) {
    if (!form) return;
    const updated = await apiPatch<CfpForm>(`/forms/${form.id}`, patch);
    setForm(updated);
  }

  async function handleCreateField(input: FieldModalInput) {
    if (!form) return;
    const created = await apiPost<FormField>(`/forms/${form.id}/fields`, input);
    setForm({ ...form, fields: [...form.fields, created] });
    setModal(null);
  }

  async function handleEditField(field: FormField, input: FieldModalInput) {
    if (!form) return;
    guardEditableField(field, 'edit');
    const updated = await apiPatch<FormField>(`/fields/${field.id}`, input);
    setForm({ ...form, fields: form.fields.map((f) => (f.id === field.id ? updated : f)) });
    setModal(null);
  }

  async function handleDeleteField(field: FormField) {
    if (!form) return;
    guardEditableField(field, 'delete');
    if (!window.confirm(`Delete the "${field.label}" field? This cannot be undone.`)) return;
    setBusy(true);
    try {
      try {
        await apiDelete(`/fields/${field.id}`);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'conflict' && window.confirm(err.message)) {
          await apiDelete(`/fields/${field.id}?cascade=1`);
        } else {
          throw err;
        }
      }
      setForm({ ...form, fields: form.fields.filter((f) => f.id !== field.id) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete field');
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveField(field: FormField, direction: -1 | 1) {
    if (!form) return;
    const ordered = [...form.fields].sort((a, b) => a.position - b.position).map((f) => f.id);
    const index = ordered.indexOf(field.id);
    const reordered = moveId(ordered, index, direction);
    if (reordered === ordered) return;

    setBusy(true);
    try {
      const result = await apiPost<{ items: FormField[] }>(`/forms/${form.id}/fields/reorder`, {
        orderedIds: reordered,
      });
      setForm({ ...form, fields: result.items });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reorder fields');
    } finally {
      setBusy(false);
    }
  }

  if (eventLoading || loading) {
    return (
      <div className="chq-page">
        <h1>Forms</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="chq-page">
        <h1>Forms</h1>
        <div className="chq-attention-frame">{eventError ?? 'No event selected. Append ?eventId=<id> to the URL.'}</div>
      </div>
    );
  }

  if (error || !form || !event) {
    return (
      <div className="chq-page">
        <h1>Forms</h1>
        <div className="chq-attention-frame">{error ?? 'Failed to load the form.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-forms-page">
      <div className="chq-forms-content">
        <h1>CFP form</h1>

        <section className="chq-forms-section">
          <h2 className="chq-forms-section-title">Settings</h2>
          <div className="chq-forms-section-body">
            <FormSettings form={form} tracks={tracks} eventSlug={event.slug} onSave={handleSaveSettings} />
          </div>
        </section>

        <section className="chq-forms-section">
          <div className="chq-forms-field-list-header chq-forms-section-title">
            <h2>Fields</h2>
            <button type="button" onClick={() => setModal({ mode: 'create' })} disabled={busy}>
              Add a question
            </button>
          </div>
          <div className="chq-forms-section-body">
            <FieldList
              fields={form.fields}
              busy={busy}
              onEdit={(field) => setModal({ mode: 'edit', field })}
              onDelete={handleDeleteField}
              onMove={handleMoveField}
            />
          </div>
        </section>
      </div>

      {modal?.mode === 'create' && (
        <FieldModal allFields={form.fields} onCancel={() => setModal(null)} onSubmit={handleCreateField} />
      )}
      {modal?.mode === 'edit' && (
        <FieldModal
          field={modal.field}
          allFields={form.fields}
          onCancel={() => setModal(null)}
          onSubmit={(input) => handleEditField(modal.field, input)}
        />
      )}
    </div>
  );
}
