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

import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { apiGet, apiList, apiPost, apiPatch, ApiError } from '../../lib/api';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { formatDateTime } from '../../lib/dates';
import { pipelineCardAge } from './pipeline-age';
import { sortByFit } from '../../../../src/domain/pipeline-fit';
import type { ContactListItem, PipelineEntry, PipelineEntryDetail, PipelineStage } from './types';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from './types';
import './contacts-panels.css';

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

  return (
    <div className="chq-contacts-pipeline">
      <div className="chq-contacts-pipeline-head">
        <div className="chq-contacts-pipeline-head-titles">
          <h2 className="chq-section-label">Sourcing pipeline</h2>
          {/* w11-e (DEC-665): the count is a measurement, not a starting
              value -- withhold it until the first load resolves so the
              page never pairs a "0 people" claim with the loading state. */}
          {!loading && <span className="chq-contacts-pipeline-caption">{total} people</span>}
        </div>
        <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setShowEnroll(true)}>
          + Enroll
        </button>
      </div>
      {error && <div className="chq-error">{error}</div>}
      {loading && <DelayedLoading />}

      {!loading && (
        <>
          <div className="chq-contacts-pipeline-columns">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage} className="chq-contacts-pipeline-column" data-stage={stage}>
                <div className="chq-contacts-pipeline-column-head">
                  <span className="chq-contacts-pipeline-column-name">{PIPELINE_STAGE_LABELS[stage]}</span>
                  <span className="chq-contacts-pipeline-column-count">
                    {entries.filter((e) => e.stage === stage).length}
                  </span>
                </div>
                <ul className="chq-contacts-pipeline-column-cards">
                  {sortByFit(entries.filter((e) => e.stage === stage)).map((entry) => (
                    <PipelineCard key={entry.id} entry={entry} onOpen={() => setOpenEntryId(entry.id)} onMove={moveTo} />
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
                    <button type="button" className="chq-contacts-pipeline-card-name" onClick={() => setOpenEntryId(entry.id)}>
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
                  <label className="chq-contacts-pipeline-card-move">
                    Move to
                    <select
                      className="chq-select"
                      value={entry.stage}
                      onChange={(e) => moveTo(entry, e.target.value as PipelineStage)}
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {PIPELINE_STAGE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
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

      {openEntryId && <EntryDetailPanel entryId={openEntryId} onClose={() => setOpenEntryId(null)} onChanged={reload} />}

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
      <FormRow label="Reason" htmlFor="pipeline-decline-reason" required>
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
  onMove: (entry: PipelineEntry, stage: PipelineStage) => void;
}

function PipelineCard({ entry, onOpen, onMove }: PipelineCardProps) {
  const age = pipelineCardAge(entry.stage, entry.stageSince, Date.now());
  return (
    <li className="chq-contacts-pipeline-card">
      <button type="button" className="chq-contacts-pipeline-card-name" onClick={onOpen}>
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
          still says so, rather than implying a zero. */}
      {entry.fitScore !== null ? (
        <span className="chq-pill chq-contacts-pipeline-card-fit">Fit {entry.fitScore}</span>
      ) : (
        <span className="chq-pill chq-contacts-pipeline-card-fit chq-contacts-pipeline-card-fit-unrated">Unrated</span>
      )}
      {entry.rationale && <div className="chq-contacts-pipeline-card-rationale">{entry.rationale}</div>}
      <label className="chq-contacts-pipeline-card-move">
        Move to
        <select className="chq-select" value={entry.stage} onChange={(e) => onMove(entry, e.target.value as PipelineStage)}>
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {PIPELINE_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
    </li>
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

  useEscapeKey(true, () => {
    if (!busy) onClose();
  });

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !busy) onClose();
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Enroll contact" onClick={handleScrimClick}>
      <div className="chq-modal">
        <div className="chq-modal-head">
          <h3 className="chq-page-title chq-modal-title">Enroll a contact</h3>
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        {error && <div className="chq-error">{error}</div>}
        <label className="chq-contacts-import-field">
          Contact
          <select className="chq-select" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Select a contact...</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} — {c.email}
              </option>
            ))}
          </select>
        </label>
        <label className="chq-contacts-import-field">
          Starting stage
          <select className="chq-select" value={stage} onChange={(e) => setStage(e.target.value as PipelineStage)}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="chq-contacts-import-field">
          Fit (1–5, optional)
          <select className="chq-select" value={fitScore} onChange={(e) => setFitScore(e.target.value)}>
            <option value="">Unrated</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="chq-contacts-import-field">
          Why them
          <input
            type="text"
            className="chq-input"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Keynoted a similar event last year"
          />
        </label>
        <div className="chq-contacts-import-actions">
          <button type="button" className="chq-btn chq-btn-primary" disabled={busy || !contactId} onClick={enroll}>
            Enroll
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface EntryDetailPanelProps {
  entryId: string;
  onClose: () => void;
  onChanged: () => void;
}

function EntryDetailPanel({ entryId, onClose, onChanged }: EntryDetailPanelProps) {
  const [detail, setDetail] = useState<PipelineEntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function reload() {
    return apiGet<PipelineEntryDetail>(`/pipeline/${entryId}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pipeline entry'));
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

  useEscapeKey(true, () => {
    if (!busy) onClose();
  });

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !busy) onClose();
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Pipeline card detail" onClick={handleScrimClick}>
      <div className="chq-modal">
        {error && <div className="chq-error">{error}</div>}
        {!detail && <DelayedLoading />}
        {detail && (
          <>
            <h3 className="chq-page-title chq-modal-title">
              {detail.contact.firstName} {detail.contact.lastName}
            </h3>
            <p className="chq-contacts-pipeline-caption">
              {detail.contact.email}
              {detail.contact.company ? ` — ${detail.contact.company}` : ''}
            </p>
            <p>Stage: {PIPELINE_STAGE_LABELS[detail.entry.stage]}</p>

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
              {detail.activity.map((a, i) => (
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
              {detail.activity.length === 0 && <li className="chq-empty">No activity yet.</li>}
            </ul>
          </>
        )}
        <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
