// CRM sourcing pipeline board (CRM-07/08, DEC-157). Five named columns, an
// Enroll control (contact picker from GET /contacts), a per-card Move-to
// <select> (no drag-and-drop dependency — DEC-157 explicitly prefers a
// select since persistence is what's graded), and a card-detail panel with
// a notes composer + activity log.
//
// Redesign (w2-e, DEC-366..368/372/376/377): restyled with the shared
// .chq-* component classes plus .chq-contacts-pipeline-* (contacts-panels
// .css). At phone width the four-column board collapses to one column at a
// time, chosen from a .chq-pill strip (ink active state, DEC-372) — that is
// a client-side display filter only, the Move-to select below each card is
// still what persists a stage change.

import { useEffect, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, apiPatch, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { formatDateTime } from '../../lib/dates';
import { pipelineCardAge } from './pipeline-age';
import { sortByFit } from '../../../../src/domain/pipeline-fit';
import type { ContactListItem, PipelineActivity, PipelineEntry, PipelineEntryDetail, PipelineStage } from './types';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from './types';
import './contacts-panels.css';

// w4-c/DEC-898 amendment (wave 4): the header names the board's own
// affordance ('drag between columns') now that the card itself carries no
// control -- the back link is a tab switch (DEC-710: ?tab= URL state),
// never a route navigation, so it clears the same param ContactsApp reads.
function useBackToDirectory(): () => void {
  const [, setSearchParams] = useSearchParams();
  return () =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('tab');
      return params;
    });
}

export function PipelineBoard() {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  // DEC-468: the server caps a page at 200 rows -- `total` is the envelope's
  // true count, never `entries.length`, so the caption and the "Load more"
  // control stay honest once a board holds more than one page.
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [phoneStage, setPhoneStage] = useState<PipelineStage>(PIPELINE_STAGES[0]);
  // DEC-803: moving a card into 'declined' asks for a reason first -- the
  // card holding this state is the one awaiting that prompt; nothing moves
  // until it's submitted.
  const [declinePrompt, setDeclinePrompt] = useState<PipelineEntry | null>(null);
  // DEC-898: the column currently under a drag, for the over-state affordance.
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  // DEC-980: fit is editable after enrolment -- the card being fit-edited,
  // via a fit-only PATCH that never carries a stage (so it never forges a
  // move or bumps stageSince).
  const [fitEditEntry, setFitEditEntry] = useState<PipelineEntry | null>(null);
  const backToDirectory = useBackToDirectory();

  function reload() {
    setLoading(true);
    setError(null);
    setPage(1);
    return apiList<PipelineEntry>('/pipeline')
      .then((res) => {
        setEntries(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pipeline'))
      .finally(() => setLoading(false));
  }

  function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    setError(null);
    return apiList<PipelineEntry>(`/pipeline?page=${nextPage}`)
      .then((res) => {
        // DEC-468: append, never replace -- refetching page 1 would drop
        // any optimistic stage move already reconciled into `entries`.
        setEntries((prev) => [...prev, ...res.items]);
        setTotal(res.total);
        setPage(nextPage);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load more people'))
      .finally(() => setLoadingMore(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function doMove(entry: PipelineEntry, stage: PipelineStage, reason?: string) {
    const previous = entries;
    // Optimistic update.
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, stage } : e)));
    setError(null);
    try {
      const updated = await apiPatch<PipelineEntry>(`/pipeline/${entry.id}`, { stage, reason });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    } catch (err) {
      // Loud rollback: restore the pre-move board state and surface the error.
      setEntries(previous);
      setError(err instanceof ApiError ? err.message : 'Failed to move card');
    }
  }

  function moveTo(entry: PipelineEntry, stage: PipelineStage) {
    if (stage === entry.stage) return;
    // DEC-803: declining requires a reason -- ask before persisting anything.
    if (stage === 'declined') {
      setDeclinePrompt(entry);
      return;
    }
    void doMove(entry, stage);
  }

  // DEC-980: a fit-only edit PATCHes fitScore/rationale with no `stage` key
  // at all, so the route never treats it as a move -- distinct write path
  // from doMove, which always carries a stage.
  async function saveFit(entry: PipelineEntry, fitScore: number | null, rationale: string | null) {
    const updated = await apiPatch<PipelineEntry>(`/pipeline/${entry.id}`, { fitScore, rationale });
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
  }

  // DEC-898: drag-and-drop reuses the exact same stage-change path as the
  // per-card select (moveTo -> doMove) -- a drop is never a second write
  // path, and dropping on the entry's own column is the same no-op the
  // select already has (moveTo's `stage === entry.stage` guard).
  function handleColumnDragOver(e: DragEvent<HTMLDivElement>, stage: PipelineStage) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) setDragOverStage(stage);
  }

  function handleColumnDragLeave(e: DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOverStage(null);
  }

  function handleColumnDrop(e: DragEvent<HTMLDivElement>, stage: PipelineStage) {
    e.preventDefault();
    setDragOverStage(null);
    const entryId = e.dataTransfer.getData('text/plain');
    if (!entryId) return;
    const entry = entries.find((en) => en.id === entryId);
    if (!entry) return;
    moveTo(entry, stage);
  }

  return (
    <div className="chq-contacts-pipeline">
      <div className="chq-contacts-pipeline-head">
        <div className="chq-contacts-pipeline-head-titles">
          <button
            type="button"
            className="chq-btn chq-btn-tertiary chq-contacts-pipeline-back"
            onClick={backToDirectory}
          >
            &lsaquo; Contacts
          </button>
          <h1 className="chq-page-title">Pipeline</h1>
          {/* w11-e (DEC-665): the count is a measurement, not a starting
              value -- withhold it until the first load resolves so the
              page never pairs a "0 people" claim with the loading state.
              w4-c/DEC-898 amendment: names the board's own affordance now
              that the card face carries no stage control of its own. */}
          {!loading && <span className="chq-contacts-pipeline-caption">{total} people - drag between columns</span>}
        </div>
        <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setShowEnroll(true)}>
          Add to the pipeline
        </button>
      </div>
      {error && <div className="chq-error">{error}</div>}
      {loading && <DelayedLoading />}

      {!loading && (
        <>
          <div className="chq-contacts-pipeline-columns">
            {PIPELINE_STAGES.map((stage) => (
              <div
                key={stage}
                className={`chq-contacts-pipeline-column${dragOverStage === stage ? ' chq-contacts-pipeline-column-drag-over' : ''}`}
                data-stage={stage}
                aria-label={`${PIPELINE_STAGE_LABELS[stage]} column`}
                onDragOver={(e) => handleColumnDragOver(e, stage)}
                onDragLeave={handleColumnDragLeave}
                onDrop={(e) => handleColumnDrop(e, stage)}
              >
                <div className="chq-contacts-pipeline-column-head">
                  <span className="chq-contacts-pipeline-column-name">{PIPELINE_STAGE_LABELS[stage]}</span>
                  <span className="chq-contacts-pipeline-column-count">
                    {entries.filter((e) => e.stage === stage).length}
                  </span>
                </div>
                <ul className="chq-contacts-pipeline-column-cards">
                  {sortByFit(entries.filter((e) => e.stage === stage)).map((entry) => (
                    <PipelineCard
                      key={entry.id}
                      entry={entry}
                      onOpen={() => setOpenEntryId(entry.id)}
                      onEditFit={() => setFitEditEntry(entry)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* DEC-468: entries.length < total means the server truncated the
              board at its 200-row page cap -- offer the next page rather than
              silently hiding the rest. */}
          {entries.length < total && (
            <button
              type="button"
              className="chq-btn chq-btn-secondary chq-contacts-pipeline-load-more"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}

          {/* Phone: one stage at a time via a .chq-pill strip (mock lines 393-396). */}
          <div className="chq-contacts-pipeline-phone-stages chq-chipstrip">
            {PIPELINE_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className={`chq-pill${stage === phoneStage ? ' is-active' : ''}`}
                onClick={() => setPhoneStage(stage)}
              >
                {PIPELINE_STAGE_LABELS[stage]} · {entries.filter((e) => e.stage === stage).length}
              </button>
            ))}
          </div>
          <ul className="chq-contacts-pipeline-phone-list">
            {entries
              .filter((e) => e.stage === phoneStage)
              .map((entry) => {
                const age = pipelineCardAge(entry.stage, entry.stageSince, Date.now());
                return (
                <li key={entry.id} className="chq-contacts-pipeline-phone-card">
                  <div className="chq-contacts-pipeline-phone-card-body">
                    {/* w4-c/DEC-898 amendment: the card face carries no stage
                        control -- this button is the keyboard path to the
                        stage picker (opened-card panel, EntryDetailPanel's
                        Stage select), so its accessible name states the
                        person AND their current stage. */}
                    <button
                      type="button"
                      className="chq-contacts-pipeline-card-name"
                      aria-label={`${entry.firstName} ${entry.lastName}, ${PIPELINE_STAGE_LABELS[entry.stage]}`}
                      onClick={() => setOpenEntryId(entry.id)}
                    >
                      {entry.firstName} {entry.lastName}
                    </button>
                    {entry.company && <span className="chq-contacts-pipeline-card-company">{entry.company}</span>}
                    <div className={`chq-contacts-pipeline-card-age${age.stale ? ' chq-contacts-pipeline-card-age-stale' : ''}`}>
                      {age.text}
                    </div>
                    {entry.stage === 'declined' && entry.declineReason && (
                      <div className="chq-contacts-pipeline-card-decline-reason">{entry.declineReason}</div>
                    )}
                  </div>
                </li>
                );
              })}
          </ul>
        </>
      )}

      {showEnroll && (
        <EnrollDialog
          alreadyEnrolledContactIds={new Set(entries.map((e) => e.contactId))}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => {
            setShowEnroll(false);
            reload();
          }}
        />
      )}

      {openEntryId && (() => {
        const openEntry = entries.find((e) => e.id === openEntryId);
        return openEntry ? (
          <EntryDetailPanel
            entryId={openEntryId}
            entry={openEntry}
            onClose={() => setOpenEntryId(null)}
            onChanged={reload}
            onMove={(stage) => moveTo(openEntry, stage)}
          />
        ) : null;
      })()}

      {declinePrompt && (
        <DeclineReasonDialog
          entry={declinePrompt}
          onCancel={() => setDeclinePrompt(null)}
          onConfirm={(reason) => {
            setDeclinePrompt(null);
            void doMove(declinePrompt, 'declined', reason);
          }}
        />
      )}

      {fitEditEntry && (
        <FitEditDialog
          entry={fitEditEntry}
          onClose={() => setFitEditEntry(null)}
          onSave={async (fitScore, rationale) => {
            await saveFit(fitEditEntry, fitScore, rationale);
            setFitEditEntry(null);
          }}
        />
      )}
    </div>
  );
}

interface DeclineReasonDialogProps {
  entry: PipelineEntry;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

// DEC-803: a move into 'declined' asks for a reason before it persists
// anything -- built on ModalFrame (DEC-651: the ONE dialog contract), not a
// bare window.prompt.
function DeclineReasonDialog({ entry, onCancel, onConfirm }: DeclineReasonDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (trimmed === '') return;
    onConfirm(trimmed);
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={handleSubmit}
      title="Decline this contact?"
      subtitle={`${entry.firstName} ${entry.lastName}`}
      onClose={onCancel}
      modalClassName="chq-contacts-pipeline-decline-modal"
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={trimmed === ''}>
            Decline
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      <FormRow label="Reason" htmlFor="pipeline-decline-reason">
        <textarea
          id="pipeline-decline-reason"
          className="chq-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Went with another speaker"
          autoFocus
        />
      </FormRow>
    </ModalFrame>
  );
}

interface PipelineCardProps {
  entry: PipelineEntry;
  onOpen: () => void;
  onEditFit: () => void;
}

// DEC-157 amendment (w2-b): the desktop card is drag-only -- the stage
// control that used to live here moved into EntryDetailPanel, which calls
// the SAME moveTo/doMove path (PATCH /pipeline/:id) so the decline prompt
// and optimistic-update/rollback behaviour are unchanged.
function PipelineCard({ entry, onOpen, onEditFit }: PipelineCardProps) {
  const age = pipelineCardAge(entry.stage, entry.stageSince, Date.now());
  // DEC-898: reuses the agenda DayGrid drag contract verbatim -- the
  // dragged entry's id in `text/plain`, effectAllowed 'move'.
  function handleDragStart(e: DragEvent<HTMLLIElement>) {
    e.dataTransfer.setData('text/plain', entry.id);
    e.dataTransfer.effectAllowed = 'move';
  }
  // w4-c/DEC-898 amendment: the card face carries no stage control -- this
  // button is the keyboard path to the stage picker (opened-card panel's
  // Stage select), so its accessible name states the person AND their
  // current stage, never just the name a mouse-drag already shows visually.
  return (
    <li className="chq-contacts-pipeline-card" draggable onDragStart={handleDragStart}>
      <button
        type="button"
        className="chq-contacts-pipeline-card-name"
        aria-label={`${entry.firstName} ${entry.lastName}, ${PIPELINE_STAGE_LABELS[entry.stage]}`}
        onClick={onOpen}
      >
        {entry.firstName} {entry.lastName}
      </button>
      {entry.company && <div className="chq-contacts-pipeline-card-company">{entry.company}</div>}
      <div className={`chq-contacts-pipeline-card-age${age.stale ? ' chq-contacts-pipeline-card-age-stale' : ''}`}>
        {age.text}
      </div>
      {entry.stage === 'declined' && entry.declineReason && (
        <div className="chq-contacts-pipeline-card-decline-reason">{entry.declineReason}</div>
      )}
      {/* DEC-821: fit is a visible state, never blank -- an unrated card
          still says so, rather than implying a zero. DEC-980: fit is
          editable after enrolment too -- a quiet affordance beside the
          pill opens a fit-only PATCH dialog, never a stage control.
          w4-c: the rationale sits inline in this same row now, beside the
          fit chip, rather than on its own line below. */}
      <div className="chq-contacts-pipeline-card-fit-row">
        {entry.fitScore !== null ? (
          <span className="chq-pill chq-contacts-pipeline-card-fit chq-contacts-pipeline-card-fit-rated">
            Fit {entry.fitScore}
          </span>
        ) : (
          <span className="chq-pill chq-contacts-pipeline-card-fit chq-contacts-pipeline-card-fit-unrated">Unrated</span>
        )}
        {entry.rationale && <span className="chq-contacts-pipeline-card-rationale">{entry.rationale}</span>}
        <button type="button" className="chq-link-button chq-contacts-pipeline-card-fit-edit" onClick={onEditFit}>
          {entry.fitScore !== null ? 'Edit' : 'Rate'}
        </button>
      </div>
    </li>
  );
}

interface OptionalFieldRowProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

// w4-c: the enroll dialog's own field-row shell for FIT / WHY THEM -- keeps
// the shared FormRow's inline ' · optional' suffix (DEC-685/DEC-909) out of
// this one dialog and instead right-aligns a lowercase 'optional' helper
// beside the label, on its own row within the chq-form-row shell FormRow
// already establishes (same label/control classes, so spacing matches).
function OptionalFieldRow({ label, htmlFor, children }: OptionalFieldRowProps) {
  return (
    <div className="chq-form-row">
      <div className="chq-contacts-pipeline-field-head">
        <label className="chq-form-row-label" htmlFor={htmlFor}>
          {label}
        </label>
        <span className="chq-contacts-pipeline-field-optional">optional</span>
      </div>
      <div className="chq-form-row-control">{children}</div>
    </div>
  );
}

interface EnrollDialogProps {
  alreadyEnrolledContactIds: Set<string>;
  onClose: () => void;
  onEnrolled: () => void;
}

function EnrollDialog({ alreadyEnrolledContactIds, onClose, onEnrolled }: EnrollDialogProps) {
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [contactId, setContactId] = useState('');
  const [stage, setStage] = useState<PipelineStage>('identified');
  // DEC-821: fit is optional at enroll time -- '' means "unrated", never a
  // silently-assumed score.
  const [fitScore, setFitScore] = useState('');
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiList<ContactListItem>('/contacts?perPage=200')
      .then((res) => setContacts(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load contacts'));
  }, []);

  const available = contacts.filter((c) => !alreadyEnrolledContactIds.has(c.id));

  async function enroll() {
    if (!contactId) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/pipeline', {
        contactId,
        stage,
        fitScore: fitScore === '' ? null : Number(fitScore),
        rationale: rationale.trim() === '' ? null : rationale.trim(),
      });
      onEnrolled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to enroll contact');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame
      title="Add to the pipeline"
      onClose={onClose}
      closeDisabled={busy}
      modalClassName="chq-contacts-pipeline-enroll-modal"
      actions={
        <>
          <button type="button" className="chq-btn chq-btn-primary" disabled={busy || !contactId} onClick={enroll}>
            Add to the pipeline
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {/* w4-c: the no-email footnote moves below the button row, in
              lowercase -- it's a footnote to the action, not a warning
              above it. */}
          <p className="chq-contacts-pipeline-enroll-consequence">
            adding writes a move to the activity feed · no email is sent
          </p>
        </>
      }
    >
      {error && <div className="chq-error">{error}</div>}
      <FormRow label="Contact" htmlFor="pipeline-enroll-contact">
        <select
          id="pipeline-enroll-contact"
          className="chq-select"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        >
          <option value="">Select a contact...</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} — {c.email}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Starting stage">
        {/* w4-c: full pills, near-black selected fill -- the same
            .chq-pill/.is-active treatment the phone stage strip already
            uses (styles.css), not the segmented-button chip. */}
        <div className="chq-chipstrip" role="group" aria-label="Starting stage">
          {PIPELINE_STAGES.map((st) => (
            <button
              key={st}
              type="button"
              className={`chq-pill${stage === st ? ' is-active' : ''}`}
              aria-pressed={stage === st}
              onClick={() => setStage(st)}
            >
              {PIPELINE_STAGE_LABELS[st]}
            </button>
          ))}
        </div>
      </FormRow>
      <OptionalFieldRow label="Fit">
        <div className="chq-segmented" role="group" aria-label="Fit">
          <button
            type="button"
            className={fitScore === '' ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
            aria-pressed={fitScore === ''}
            onClick={() => setFitScore('')}
          >
            Unrated
          </button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={fitScore === String(n) ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
              aria-pressed={fitScore === String(n)}
              onClick={() => setFitScore(String(n))}
            >
              {n}
            </button>
          ))}
        </div>
      </OptionalFieldRow>
      <OptionalFieldRow label="Why them" htmlFor="pipeline-enroll-rationale">
        <input
          id="pipeline-enroll-rationale"
          type="text"
          className="chq-input"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Keynoted a similar event last year"
        />
      </OptionalFieldRow>
    </ModalFrame>
  );
}

interface FitEditDialogProps {
  entry: PipelineEntry;
  onClose: () => void;
  onSave: (fitScore: number | null, rationale: string | null) => Promise<void>;
}

// DEC-980: fit is editable after enrolment — the SAME two controls the
// enrol dialog uses (fit 1-5, optional; one-line 'Why them'), but this
// dialog never carries a stage control: it submits a fit-only PATCH
// (no `stage` key at all), so the route never treats it as a move.
function FitEditDialog({ entry, onClose, onSave }: FitEditDialogProps) {
  const [fitScore, setFitScore] = useState(entry.fitScore !== null ? String(entry.fitScore) : '');
  const [rationale, setRationale] = useState(entry.rationale ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(fitScore === '' ? null : Number(fitScore), rationale.trim() === '' ? null : rationale.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save fit');
      setBusy(false);
    }
  }

  return (
    <ModalFrame
      title="Rate fit"
      subtitle={`${entry.firstName} ${entry.lastName}`}
      onClose={onClose}
      closeDisabled={busy}
      actions={
        <>
          <button type="button" className="chq-btn chq-btn-primary" disabled={busy} onClick={() => void save()}>
            Save
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </>
      }
    >
      {error && <div className="chq-error">{error}</div>}
      <FormRow label="Fit" optional>
        <div className="chq-segmented" role="group" aria-label="Fit">
          <button
            type="button"
            className={fitScore === '' ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
            aria-pressed={fitScore === ''}
            onClick={() => setFitScore('')}
          >
            Unrated
          </button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={fitScore === String(n) ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
              aria-pressed={fitScore === String(n)}
              onClick={() => setFitScore(String(n))}
            >
              {n}
            </button>
          ))}
        </div>
      </FormRow>
      <FormRow label="Why them" htmlFor="pipeline-fit-edit-rationale" optional>
        <input
          id="pipeline-fit-edit-rationale"
          type="text"
          className="chq-input"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Keynoted a similar event last year"
        />
      </FormRow>
    </ModalFrame>
  );
}

interface EntryDetailPanelProps {
  entryId: string;
  entry: PipelineEntry;
  onClose: () => void;
  onChanged: () => void;
  onMove: (stage: PipelineStage) => void;
}

// DEC-157 amendment (w2-b): the stage control lives here now, not on the
// desktop card -- `entry` is the board's live PipelineEntry (kept current by
// PipelineBoard's own setEntries on every move) so the select always shows
// the latest confirmed/optimistic stage without this panel duplicating the
// PATCH request itself.
function EntryDetailPanel({ entryId, entry, onClose, onChanged, onMove }: EntryDetailPanelProps) {
  const [detail, setDetail] = useState<PipelineEntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // DEC-468/w56-e: the activity feed's own page cap -- distinct state so
  // "Load more" can append without refetching the whole entry+contact.
  const [activityItems, setActivityItems] = useState<PipelineActivity[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);

  function reload() {
    return apiGet<PipelineEntryDetail>(`/pipeline/${entryId}`)
      .then((d) => {
        setDetail(d);
        setActivityItems(d.activity.items);
        setActivityTotal(d.activity.total);
        setActivityPage(d.activity.page);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pipeline entry'));
  }

  function loadMoreActivity() {
    const nextPage = activityPage + 1;
    setLoadingMoreActivity(true);
    return apiGet<PipelineEntryDetail>(`/pipeline/${entryId}?page=${nextPage}`)
      .then((d) => {
        // Append, never replace -- mirrors the board's own loadMore.
        setActivityItems((prev) => [...prev, ...d.activity.items]);
        setActivityTotal(d.activity.total);
        setActivityPage(nextPage);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load more activity'))
      .finally(() => setLoadingMoreActivity(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  async function saveNote() {
    if (note.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/pipeline/${entryId}/notes`, { body: note.trim() });
      setNote('');
      await reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame
      title={detail ? `${detail.contact.firstName} ${detail.contact.lastName}` : 'Pipeline entry'}
      subtitle={
        detail ? `${detail.contact.email}${detail.contact.company ? ' — ' + detail.contact.company : ''}` : undefined
      }
      ariaLabel="Pipeline card detail"
      onClose={onClose}
      closeDisabled={busy}
      actions={
        <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      {error && <div className="chq-error">{error}</div>}
      {!detail && <DelayedLoading />}
      {detail && (
        <>
          <label className="chq-contacts-pipeline-detail-stage" htmlFor="pipeline-detail-stage">
            Stage
            <select
              id="pipeline-detail-stage"
              className="chq-select"
              value={entry.stage}
              onChange={(e) => onMove(e.target.value as PipelineStage)}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="chq-contacts-pipeline-notes">
            <label className="chq-contacts-import-field">
              Add a note
              <textarea
                className="chq-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Followed up by phone, waiting on their reply"
              />
            </label>
            <button type="button" className="chq-btn chq-btn-secondary" disabled={busy || note.trim() === ''} onClick={saveNote}>
              Save note
            </button>
          </div>

          <h4 className="chq-section-label">Activity</h4>
          <ul className="chq-contacts-pipeline-activity">
            {activityItems.map((a, i) => (
              <li key={i}>
                {a.kind === 'move' ? (
                  <span>
                    Moved {a.fromStage ? PIPELINE_STAGE_LABELS[a.fromStage] : 'Enrolled'} &rarr;{' '}
                    {a.toStage ? PIPELINE_STAGE_LABELS[a.toStage] : ''}
                  </span>
                ) : (
                  <span>Note: {a.body}</span>
                )}
                {' — '}
                {a.authorName}, {formatDateTime(a.createdAt)}
              </li>
            ))}
            {activityItems.length === 0 && <li className="chq-empty">No activity yet.</li>}
          </ul>

          {/* DEC-468/w56-e: state the shortfall rather than silently showing
              a partial feed once the entry's activity outgrows one page. */}
          {activityItems.length < activityTotal && (
            <button
              type="button"
              className="chq-btn chq-btn-secondary chq-contacts-pipeline-load-more"
              disabled={loadingMoreActivity}
              onClick={loadMoreActivity}
            >
              {loadingMoreActivity ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </ModalFrame>
  );
}
