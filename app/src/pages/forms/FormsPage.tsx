import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { msToDateInput, dateInputToMs } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DateField } from '../../components/DateField';
import { PageSkeleton } from '../../components/PageSkeleton';
import { FieldList } from './FieldList';
import { FieldModal, type FieldModalInput } from './FieldModal';
import { guardEditableField, moveId } from './logic';
import type { CfpForm, EventTrack, FormField } from './types';
import { MAX_FORM_FIELDS } from '../../lib/batch-caps';
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

// DEC-505 (wave-53 amendment): the PATCH-side sibling of DeleteConfirmState.
// A 409 naming `fields.dependents` means the edit would clear one or more
// sibling questions' visibility rules -- confirm with the server's message,
// retry with ?cascade=1. Carries the field + the submitted input so Confirm
// can re-issue the exact same PATCH the organizer already made.
type EditCascadeConfirmState = { field: FormField; input: FieldModalInput; message: string } | null;

type ReceivedState = { total: number } | 'loading' | 'error';

/** J1 form builder SPA (DEC-033, DEC-650 mock rebuild): loads the event's
 * default CFP form and renders the header band (Preview + the wave-72
 * window-editing Save), the Opens/Closes/Received strip (Opens/Closes now
 * an editable CFP window, Received a read-only fact), the field list (the
 * page's primary content), and the settings link below it. Zero new
 * server code — every call goes through the landed w2-c forms API via
 * api.ts. */
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
  const [editCascadeConfirm, setEditCascadeConfirm] = useState<EditCascadeConfirmState>(null);
  const [editCascadeBusy, setEditCascadeBusy] = useState(false);
  const [received, setReceived] = useState<ReceivedState>('loading');
  const [linkCopyResult, setLinkCopyResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Amendment (wave 72): the Opens/Closes strip cells become the page's
  // editable CFP window. openInput/closeInput hold the DateField wire
  // strings (yyyy-mm-dd), seeded from the loaded form and re-seeded on
  // every reload; Save is disabled until they differ from the loaded
  // form's values, so it never claims work it has none of.
  const [openInput, setOpenInput] = useState('');
  const [closeInput, setCloseInput] = useState('');
  const [windowSaving, setWindowSaving] = useState(false);
  const [windowFieldErrors, setWindowFieldErrors] = useState<Record<string, string>>({});

  // The builder is the organiser's authoritative view of what the public
  // form actually asks (DEC-008 amendment): the event's tracks feed the
  // SAME single Track question src/routes/public/submit-views.tsx renders
  // (TrackChoices), so this reader is folded into the page's one existing
  // load() Promise.all rather than a second effect/fetch.
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
        setOpenInput(msToDateInput(formResult.openDate ?? null));
        setCloseInput(msToDateInput(formResult.closeDate ?? null));
        setWindowFieldErrors({});
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

  async function handleCreateField(input: FieldModalInput) {
    if (!form) return;
    const created = await apiPost<FormField>(`/forms/${form.id}/fields`, input);
    setForm({ ...form, fields: [...form.fields, created] });
    setModal(null);
  }

  async function handleEditField(field: FormField, input: FieldModalInput) {
    if (!form) return;
    guardEditableField(field, 'edit');
    try {
      const updated = await apiPatch<FormField>(`/fields/${field.id}`, input);
      setForm({ ...form, fields: form.fields.map((f) => (f.id === field.id ? updated : f)) });
      setModal(null);
    } catch (err) {
      // DEC-505 (wave-53 amendment): a conflict naming `fields.dependents`
      // is a confirm-to-proceed door, not a terminal refusal -- render the
      // cascade confirm and resolve normally (no rethrow) so FieldModal's
      // own error banner stays quiet and the organizer isn't double-told.
      // A conflict WITHOUT dependents (kind/section/option answer guards)
      // is terminal -- rethrow so FieldModal paints its banner as before.
      if (err instanceof ApiError && err.code === 'conflict' && err.fields?.dependents) {
        setEditCascadeConfirm({ field, input, message: err.message });
        return;
      }
      throw err;
    }
  }

  async function confirmEditCascade() {
    if (!form || !editCascadeConfirm) return;
    const { field, input } = editCascadeConfirm;
    setEditCascadeBusy(true);
    try {
      await apiPatch<FormField>(`/fields/${field.id}?cascade=1`, input);
      load();
      setEditCascadeConfirm(null);
      setModal(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save field');
      setEditCascadeConfirm(null);
    } finally {
      setEditCascadeBusy(false);
    }
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

  // Amendment (wave 72): the SAME endpoint and payload keys
  // CallForPapersPanel already uses -- the server's close-before-open
  // refusal (DEC-731/DEC-517) stays the only place that rule lives; a
  // 400 naming openDate/closeDate renders on the strip cell it names,
  // never a page-level banner.
  async function handleSaveWindow() {
    if (!form) return;
    setWindowSaving(true);
    setWindowFieldErrors({});
    try {
      const updated = await apiPatch<CfpForm>(`/forms/${form.id}`, {
        openDate: dateInputToMs(openInput),
        closeDate: dateInputToMs(closeInput),
      });
      setForm(updated);
      setOpenInput(msToDateInput(updated.openDate ?? null));
      setCloseInput(msToDateInput(updated.closeDate ?? null));
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setWindowFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save the CFP window');
      }
    } finally {
      setWindowSaving(false);
    }
  }

  if (eventLoading || loading) {
    return (
      <div className="chq-page chq-measure">
        <h1>Forms</h1>
        <PageSkeleton variant="list" />
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="chq-page chq-measure">
        <h1>Forms</h1>
        <div className="chq-attention-frame">{eventError ?? 'No event selected. Append ?eventId=<id> to the URL.'}</div>
      </div>
    );
  }

  if (error || !form || !event) {
    return (
      <div className="chq-page chq-measure">
        <h1>Forms</h1>
        <div className="chq-attention-frame">{error ?? 'Failed to load the form.'}</div>
      </div>
    );
  }

  const receivedText = received === 'loading' || received === 'error' ? '—' : `${received.total} submissions`;
  // Amendment (wave 72): Save is disabled until the strip differs from the
  // loaded form, so it never claims work it has none of.
  const windowDirty =
    openInput !== msToDateInput(form.openDate ?? null) || closeInput !== msToDateInput(form.closeDate ?? null);
  const publicLink = `${window.location.origin}/submit/${event.slug}`;
  // DEC-015/DEC-416: the public form offers form.tracks (a chosen subset)
  // when set/non-empty, else every event track (src/lib/submit-core.ts's
  // resolveOfferedTrackIds) -- the SAME rule here, applied to the already-
  // loaded event track objects, so the builder's Track row shows exactly
  // the options the public form actually offers, never the full event
  // track list when the CFP has been scoped to a subset.
  const offeredTrackIds = form.tracks && form.tracks.length > 0 ? new Set(form.tracks) : null;
  const offeredTracks = offeredTrackIds ? tracks.filter((t) => offeredTrackIds.has(t.id)) : tracks;
  // Frame grammar: the footer row displays host+path with the protocol
  // stripped ('<host>/submit/...'); Copy still copies the absolute
  // URL below.
  const publicLinkDisplay = `${window.location.host}/submit/${event.slug}`;

  async function handleCopyPublicLink() {
    const ok = await copyText(publicLink);
    setLinkCopyResult({ ok, text: publicLink });
    if (ok) {
      window.setTimeout(() => setLinkCopyResult(null), 2000);
    }
  }

  return (
    <div className="chq-page chq-forms-page chq-measure-table">
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
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            disabled={!windowDirty || windowSaving}
            onClick={() => void handleSaveWindow()}
          >
            {windowSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <div className="chq-forms-content">
        <div className="chq-forms-strip">
          <div className="chq-forms-strip-cell">
            <label className="chq-forms-strip-label" htmlFor="chq-forms-open-date">
              Opens
            </label>
            <DateField
              id="chq-forms-open-date"
              className="chq-forms-strip-datefield"
              value={openInput}
              onChange={(next) => {
                setOpenInput(next);
                setWindowFieldErrors((prev) => ({ ...prev, openDate: '' }));
              }}
            />
            {windowFieldErrors.openDate ? (
              <span className="chq-field-error">{windowFieldErrors.openDate}</span>
            ) : null}
          </div>
          <div className="chq-forms-strip-cell">
            <label className="chq-forms-strip-label" htmlFor="chq-forms-close-date">
              Closes
            </label>
            <DateField
              id="chq-forms-close-date"
              className="chq-forms-strip-datefield"
              value={closeInput}
              onChange={(next) => {
                setCloseInput(next);
                setWindowFieldErrors((prev) => ({ ...prev, closeDate: '' }));
              }}
            />
            {windowFieldErrors.closeDate ? (
              <span className="chq-field-error">{windowFieldErrors.closeDate}</span>
            ) : null}
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
              className="chq-link-button chq-forms-add-question"
              onClick={() => setModal({ mode: 'create' })}
              disabled={busy}
            >
              Add a question
            </button>
            <span className="chq-forms-field-cap-hint">
              {form.fields.length} of {MAX_FORM_FIELDS} questions
            </span>
          </div>
          <div className="chq-forms-section-body">
            <FieldList
              fields={form.fields}
              tracks={offeredTracks}
              busy={busy}
              onEdit={(field) => setModal({ mode: 'edit', field })}
              onDelete={handleDeleteField}
              onMove={handleMoveField}
            />

            <div className="chq-forms-fields-footer">
              <span className="chq-forms-fields-footer-label">Public link</span>
              <span className="chq-forms-fields-footer-value">{publicLinkDisplay}</span>
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
            <Link to="/settings?section=cfp" className="chq-forms-settings-link">
              Settings &rsaquo; Call for papers
            </Link>
          </div>
        </section>
      </div>

      {/* Phone-only fixed footer (DEC-650 mock, 390px frame): display:none
          at desktop; forms.css switches at 700px. Frozen (mobile is
          out of scope for the wave-72 window editor): the header's
          window-editing Save is desktop-only chrome (.chq-forms-header-
          actions hides at phone width), and the CFP window can still be
          edited via Settings › Call for papers on phone -- the only
          remaining phone action here is Preview. */}
      <div className="chq-forms-phone-footer">
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
          pending={busy}
          onConfirm={confirmDeleteField}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {editCascadeConfirm && (
        <ConfirmDialog
          title="Confirm field change"
          body={editCascadeConfirm.message}
          confirmLabel="Change anyway"
          pending={editCascadeBusy}
          onConfirm={confirmEditCascade}
          onCancel={() => setEditCascadeConfirm(null)}
        />
      )}
    </div>
  );
}
