import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { formatDateOnlyLong } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DelayedLoading } from '../../components/DelayedLoading';
import { FieldList } from './FieldList';
import { FieldModal, type FieldModalInput } from './FieldModal';
import { FormSettings, type FormSettingsHandle, type FormSettingsPatch } from './FormSettings';
import { guardEditableField, moveId } from './logic';
import type { CfpForm, EventTrack, FormField } from './types';
import './forms.css';

interface EventSummary {
  id: string;
  slug: string;
  timezone: string;
}

type ModalState = { mode: 'create' } | { mode: 'edit'; field: FormField } | null;

// DEC-631: the field's own delete confirm, and (if the server reports a
// 409 conflict) a second confirm rendering the server's message with a
// "Delete anyway" retry that cascades.
type DeleteConfirmState = { field: FormField; conflictMessage?: string } | null;

type ReceivedState = { total: number } | 'loading' | 'error';

/** J1 form builder SPA (DEC-033, DEC-650 mock rebuild): loads the event's
 * default CFP form and renders the header band, the Opens/Closes/Received
 * strip, the field list (now the page's primary content), and the
 * settings panel below it. Zero new server code — every call goes through
 * the landed w2-c forms API via api.ts. */
export function FormsPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [form, setForm] = useState<CfpForm | null>(null);
  const [tracks, setTracks] = useState<EventTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [received, setReceived] = useState<ReceivedState>('loading');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkCopyResult, setLinkCopyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const settingsRef = useRef<FormSettingsHandle>(null);

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

  // Received count: a real read of the submissions list total, never a
  // fabricated/derived number. '—' while loading or on failure.
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setReceived('loading');
    apiList<unknown>(`/events/${eventId}/submissions?perPage=1`)
      .then((result) => {
        if (!cancelled) setReceived({ total: result.total });
      })
      .catch(() => {
        if (!cancelled) setReceived('error');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleSaveSettings(patch: FormSettingsPatch) {
    if (!form) return;
    const updated = await apiPatch<CfpForm>(`/forms/${form.id}`, patch);
    setForm(updated);
  }

  async function handleHeaderSave() {
    setSaveError(null);
    setBusy(true);
    try {
      await settingsRef.current?.save();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save the form');
    } finally {
      setBusy(false);
    }
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

  function handleDeleteField(field: FormField) {
    if (!form) return;
    guardEditableField(field, 'delete');
    setDeleteConfirm({ field });
  }

  async function confirmDeleteField() {
    if (!form || !deleteConfirm) return;
    const { field, conflictMessage } = deleteConfirm;
    setBusy(true);
    try {
      if (conflictMessage) {
        await apiDelete(`/fields/${field.id}?cascade=1`);
      } else {
        try {
          await apiDelete(`/fields/${field.id}`);
        } catch (err) {
          if (err instanceof ApiError && err.code === 'conflict') {
            setDeleteConfirm({ field, conflictMessage: err.message });
            return;
          }
          throw err;
        }
      }
      setForm({ ...form, fields: form.fields.filter((f) => f.id !== field.id) });
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete field');
      setDeleteConfirm(null);
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
        <DelayedLoading />
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

  const receivedText = received === 'loading' || received === 'error' ? '—' : `${received.total} submissions`;
  const publicLink = `${window.location.origin}/submit/${event.slug}`;

  async function handleCopyPublicLink() {
    const ok = await copyText(publicLink);
    setLinkCopyResult({ ok, text: publicLink });
    if (ok) {
      window.setTimeout(() => setLinkCopyResult(null), 2000);
    }
  }

  return (
    <div className="chq-page chq-forms-page">
      <header className="chq-forms-header">
        <div className="chq-forms-header-titles">
          <Link to="/submissions" className="chq-forms-back">
            &lsaquo; Submissions
          </Link>
          <h1>CFP form</h1>
        </div>
        <div className="chq-forms-header-actions">
          <a href={`/submit/${event.slug}`} target="_blank" rel="noreferrer" className="chq-btn chq-btn-secondary">
            Preview
          </a>
          <button type="button" className="chq-btn chq-btn-primary" disabled={busy} onClick={() => void handleHeaderSave()}>
            Save
          </button>
        </div>
      </header>

      <div className="chq-forms-content">
        {saveError && <div className="chq-error-banner">{saveError}</div>}

        <div className="chq-forms-strip">
          <div className="chq-forms-strip-cell">
            <span className="chq-forms-strip-label">Opens</span>
            <span className="chq-forms-strip-value">{formatDateOnlyLong(form.openDate)}</span>
          </div>
          <div className="chq-forms-strip-cell">
            <span className="chq-forms-strip-label">Closes</span>
            <span className="chq-forms-strip-value">{formatDateOnlyLong(form.closeDate)}</span>
          </div>
          <div className="chq-forms-strip-cell">
            <span className="chq-forms-strip-label">Received</span>
            <span className="chq-forms-strip-value">{receivedText}</span>
          </div>
        </div>

        <section className="chq-forms-section">
          <div className="chq-forms-field-list-header chq-forms-section-title">
            <h2>Fields</h2>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => setModal({ mode: 'create' })}
              disabled={busy}
            >
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

            <div className="chq-forms-fields-footer">
              <span className="chq-forms-fields-footer-label">Public link</span>
              <span className="chq-forms-fields-footer-value">{publicLink}</span>
              <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => void handleCopyPublicLink()}>
                {linkCopyResult?.ok ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div role="status" aria-live="polite" className="chq-copy-status">
              {linkCopyResult
                ? linkCopyResult.ok
                  ? 'Copied'
                  : 'Copy failed — select the text and copy it manually'
                : null}
            </div>
          </div>
        </section>

        <section className="chq-forms-section">
          <div className="chq-forms-section-title">
            <h2>Settings</h2>
          </div>
          <div className="chq-forms-section-body">
            <FormSettings
              ref={settingsRef}
              form={form}
              tracks={tracks}
              timezone={event.timezone}
              onSave={handleSaveSettings}
            />
          </div>
        </section>
      </div>

      {/* Phone-only fixed footer (DEC-650 mock, 390px frame): a second,
          CSS-toggled markup rather than a text swap -- the phone footer's
          primary action reads "Save the form", not "Save" (display:none
          at desktop; forms.css switches the pair at 700px). */}
      <div className="chq-forms-phone-footer">
        <button
          type="button"
          className="chq-btn chq-btn-primary"
          disabled={busy}
          onClick={() => void handleHeaderSave()}
        >
          Save the form
        </button>
        <a href={`/submit/${event.slug}`} target="_blank" rel="noreferrer" className="chq-btn chq-btn-secondary">
          Preview
        </a>
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

      {deleteConfirm && !deleteConfirm.conflictMessage && (
        <ConfirmDialog
          title="Delete field"
          body={`Delete the "${deleteConfirm.field.label}" field? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          pending={busy}
          onConfirm={confirmDeleteField}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      {deleteConfirm?.conflictMessage && (
        <ConfirmDialog
          title="Delete field"
          body={deleteConfirm.conflictMessage}
          confirmLabel="Delete anyway"
          destructive
          pending={busy}
          onConfirm={confirmDeleteField}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
