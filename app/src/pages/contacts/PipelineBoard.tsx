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
import { EmptyState } from '../../components/EmptyState';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { formatDateTime } from '../../lib/dates';
import { plural, capitalizeFirst, spellCount } from '../../lib/plural';
import { pipelineCardAge } from './pipeline-age';
import { sortByFit } from '../../../../src/domain/pipeline-fit';
import { PIPELINE_RATIONALE_MAX_LEN } from '../../lib/domain-caps';
import type { ContactListItem, PipelineActivity, PipelineEntry, PipelineEntryDetail, PipelineStage } from './types';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from './types';
import { DEC_856 } from '../../../../src/decisions';
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from '../../lib/text-caps';
import './contacts-panels.css';

// DEC-856 (wave 65-d amendment): the pipeline's four writers -- move (PATCH
// /pipeline/:id with `stage`), enroll (POST /pipeline), save fit (PATCH
// /pipeline/:id with fitScore/rationale, no stage) and save note (POST
// /pipeline/:id/notes) -- each keep their OWN field-error state (never one
// shared map: a rejected note must never mark the fit form, and a rejected
// card move marks the card it came from, not the column). A key the surface
// doesn't own still renders, labelled "<key>: <message>", never folded into
// a bare "Validation failed" string. `void DEC_856` keeps this citation
// compile-checked against src/decisions.ts (never hand-edited).
void DEC_856;

type FieldErrors = Record<string, string>;

/** ErrorSummary problems for a whole fieldErrors map: known keys resolve to
 * their control's short label + real id; unmatched keys resolve to a
 * synthesized `${idPrefix}-${key}` anchor and a self-labelling
 * "<key>: <message>" link text, per DEC-856 rule 4. */
function fieldErrorProblems(
  fieldErrors: FieldErrors,
  labels: Record<string, string>,
  ids: Record<string, string>,
  idPrefix: string,
): Array<{ anchorId: string; label: string }> {
  return Object.entries(fieldErrors).map(([key, message]) => {
    const label = labels[key];
    if (label && ids[key]) return { anchorId: ids[key], label };
    return { anchorId: `${idPrefix}-${key}`, label: `${key}: ${message}` };
  });
}

/** The keys of a fieldErrors map that this surface has no dedicated control
 * for -- rendered as their own labelled `.chq-field-error` span rather than
 * dropped, per DEC-856 rule 4. */
function unmatchedFieldErrors(fieldErrors: FieldErrors, labels: Record<string, string>): Array<[string, string]> {
  return Object.entries(fieldErrors).filter(([key]) => !labels[key]);
}

// w4-c/DEC-898 amendment (wave 4): the header names the board's own
// affordance ('drag between columns') now that the card itself carries no
// control -- the back link is a tab switch (DEC-710: ?tab= URL state),
// never a route navigation, so it clears the same param ContactsApp reads.
// Frame 08-contacts--14/B7 exemplar: a stage-appropriate heading (never the
// generic "No one in X") plus a body naming the REAL count of the previous
// stage, so the empty column reads as a place in a live funnel rather than a
// dead end.
const STAGE_EMPTY_HEADINGS: Record<PipelineStage, string> = {
  identified: 'Nobody has been identified yet',
  contacted: 'Nobody has been contacted yet',
  interested: 'No one has said they are interested yet',
  confirmed: 'Nobody has said yes yet',
  declined: 'Nobody has declined yet',
};

function stageEmptyBody(stage: PipelineStage, entries: PipelineEntry[]): string {
  const idx = PIPELINE_STAGES.indexOf(stage);
  const prevStage = idx > 0 ? PIPELINE_STAGES[idx - 1] : undefined;
  if (!prevStage) {
    return 'Cards land here once someone is added to the pipeline, or you can add someone straight to this stage.';
  }
  const prevCount = entries.filter((e) => e.stage === prevStage).length;
  const countPhrase = `${capitalizeFirst(spellCount(prevCount))} ${plural(prevCount, 'person', 'people')} ${plural(prevCount, 'is', 'are')}`;
  return `${countPhrase} in ${PIPELINE_STAGE_LABELS[prevStage]}. Cards land here when you move them, or you can add someone straight to this stage.`;
}

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
  // Item 5 (frame 08-contacts--14/B7): an empty stage's tertiary "Add
  // someone to <stage> ›" opens this SAME dialog preset to that stage,
  // rather than a second enroll path -- the header's own trigger always
  // resets to the first stage.
  const [enrollStage, setEnrollStage] = useState<PipelineStage>(PIPELINE_STAGES[0]);
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
  // DEC-856: move refusals, keyed by the entry id that was moved -- a
  // rejected move attaches to the CARD it came from, never a shared banner
  // that would mark every card in the column.
  const [moveErrors, setMoveErrors] = useState<Record<string, FieldErrors>>({});
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
    // DEC-856: clear only THIS card's prior refusal at the start of the
    // attempt -- never the whole moveErrors map.
    setMoveErrors((prev) => {
      if (!(entry.id in prev)) return prev;
      const next = { ...prev };
      delete next[entry.id];
      return next;
    });
    try {
      const updated = await apiPatch<PipelineEntry>(`/pipeline/${entry.id}`, { stage, reason });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
      setMoveErrors((prev) => {
        if (!(entry.id in prev)) return prev;
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    } catch (err) {
      // Loud rollback: restore the pre-move board state and surface the
      // error -- the board never silently keeps the optimistic position
      // without saying so.
      setEntries(previous);
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setMoveErrors((prev) => ({ ...prev, [entry.id]: err.fields! }));
        setError(`Could not move ${entry.firstName} ${entry.lastName}.`);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to move card');
      }
    }
  }

  function openEnrollAt(stage: PipelineStage) {
    setEnrollStage(stage);
    setShowEnroll(true);
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
          {!loading && <span className="chq-contacts-pipeline-caption">{total} people · drag between columns</span>}
        </div>
        <button
          type="button"
          className="chq-btn chq-btn-secondary"
          onClick={() => {
            setEnrollStage(PIPELINE_STAGES[0]);
            setShowEnroll(true);
          }}
        >
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
                {(() => {
                  const stageEntries = sortByFit(entries.filter((e) => e.stage === stage));
                  if (stageEntries.length === 0) {
                    // Item 5 (frame 08-contacts--14, B7 exemplar): the
                    // column's own name/count header stays visible above
                    // this (the stage split is the excluding facet), but
                    // this state also carries a real, honest action -- the
                    // frame draws a tertiary "Add someone to <stage> ›" that
                    // opens the SAME Add-to-the-pipeline dialog preset to
                    // this stage. The shared EmptyState component's
                    // 'filtered' variant refuses any action prop by
                    // contract (B7: no primary button over a filter) and
                    // its 'secondary' slot is a route Link, not an
                    // onClick -- neither fits an in-page dialog trigger, so
                    // this composes the same shared classes directly rather
                    // than stretching EmptyState's contract.
                    return (
                      <div className="chq-empty-block chq-empty-block-filtered chq-contacts-pipeline-column-empty">
                        <p className="chq-empty-what">{STAGE_EMPTY_HEADINGS[stage]}</p>
                        <p className="chq-empty-reason">{stageEmptyBody(stage, entries)}</p>
                        <div className="chq-empty-actions">
                          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => openEnrollAt(stage)}>
                            {`Add someone to ${PIPELINE_STAGE_LABELS[stage]} ›`}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <ul className="chq-contacts-pipeline-column-cards">
                      {stageEntries.map((entry) => (
                        <PipelineCard
                          key={entry.id}
                          entry={entry}
                          moveError={moveErrors[entry.id]}
                          onOpen={() => setOpenEntryId(entry.id)}
                        />
                      ))}
                    </ul>
                  );
                })()}
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
                const entryMoveError = moveErrors[entry.id];
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
                      <div className="chq-contacts-pipeline-card-decline-reason">Declined: {entry.declineReason}</div>
                    )}
                    {/* DEC-856: same per-card attach as the desktop board. */}
                    {entryMoveError && Object.keys(entryMoveError).length > 0 && (
                      <div className="chq-contacts-pipeline-card-move-error">
                        {moveErrorMessages(entryMoveError).map(({ key, text }) => (
                          <span key={key} role="alert" className="chq-field-error">
                            {text}
                          </span>
                        ))}
                      </div>
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
          initialStage={enrollStage}
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
            moveError={moveErrors[openEntry.id]}
            onClose={() => setOpenEntryId(null)}
            onChanged={reload}
            onMove={(stage) => moveTo(openEntry, stage)}
            onEditFit={() => setFitEditEntry(openEntry)}
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
          maxLength={MAX_TEXT_LENGTH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Went with another speaker"
          autoFocus
        />
      </FormRow>
    </ModalFrame>
  );
}

// DEC-856: the move writer's own known-field labels -- `stage`/`reason` map
// to their message with a short prefix; `patch` (the form-level "must
// change stage, fitScore, or rationale" refusal, unreachable from any
// current caller but never silently dropped if the route ever adds one)
// falls through the fieldErrorProblems/unmatchedFieldErrors fallback and
// renders labelled "patch: <message>" like any other unmatched key.
const MOVE_FIELD_LABELS: Record<string, string> = {
  stage: 'Stage',
  reason: 'Decline reason',
};

function moveErrorMessages(fields: FieldErrors): Array<{ key: string; text: string }> {
  return Object.entries(fields).map(([key, message]) => {
    const label = MOVE_FIELD_LABELS[key];
    return { key, text: label ? `${label}: ${message}` : `${key}: ${message}` };
  });
}

interface PipelineCardProps {
  entry: PipelineEntry;
  moveError?: FieldErrors;
  onOpen: () => void;
}

// DEC-157 amendment (w2-b): the desktop card is drag-only -- the stage
// control that used to live here moved into EntryDetailPanel, which calls
// the SAME moveTo/doMove path (PATCH /pipeline/:id) so the decline prompt
// and optimistic-update/rollback behaviour are unchanged.
//
// Item 7 (frame 08-contacts--04): the card carries NO per-card control at
// all now, fit editing included -- the frame draws name / company / one
// line carrying the Fit chip and the reason side by side (upright, not
// italic) / 'Added N days ago' LAST, with no Edit affordance anywhere on
// the card face. The fit-only PATCH capability that used to live behind
// the removed 'Edit'/'Rate' link is still reachable, just moved onto the
// card's existing click-target -- EntryDetailPanel (opened via the name
// button below) now carries its own Fit row with the same edit trigger.
function PipelineCard({ entry, moveError, onOpen }: PipelineCardProps) {
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
      {/* DEC-898 amendment (w1-e/B18): the decline reason carries its own
          lead-in so it can never be mistaken for the fit rationale below --
          the two are visually identical muted upright text with nothing but
          position to distinguish them otherwise. */}
      {entry.stage === 'declined' && entry.declineReason && (
        <div className="chq-contacts-pipeline-card-decline-reason">Declined: {entry.declineReason}</div>
      )}
      {/* DEC-856: a rejected move attaches to the card it came from -- the
          rollback above already restored its prior stage, and this names
          why, rather than leaving the reversion unexplained. */}
      {moveError && Object.keys(moveError).length > 0 && (
        <div className="chq-contacts-pipeline-card-move-error">
          {moveErrorMessages(moveError).map(({ key, text }) => (
            <span key={key} role="alert" className="chq-field-error">
              {text}
            </span>
          ))}
        </div>
      )}
      {/* DEC-821: fit is a visible state, never blank -- an unrated card
          still says so, rather than implying a zero. w4-c: the rationale
          sits inline in this same row, beside the fit chip. Item 7: upright
          (not italic), and no per-card Edit link. */}
      <div className="chq-contacts-pipeline-card-fit-row">
        {entry.fitScore !== null ? (
          <span className="chq-pill chq-contacts-pipeline-card-fit chq-contacts-pipeline-card-fit-rated">
            Fit {entry.fitScore}
          </span>
        ) : (
          <span className="chq-pill chq-contacts-pipeline-card-fit chq-contacts-pipeline-card-fit-unrated">Unrated</span>
        )}
        {entry.rationale && <span className="chq-contacts-pipeline-card-rationale">{entry.rationale}</span>}
      </div>
      {/* Item 7: 'Added N days ago' moves LAST, after the fit/reason line. */}
      <div className={`chq-contacts-pipeline-card-age${age.stale ? ' chq-contacts-pipeline-card-age-stale' : ''}`}>
        {age.text}
      </div>
    </li>
  );
}

interface OptionalFieldRowProps {
  label: string;
  htmlFor?: string;
  // Ruling A21 (item 6): frame 08-contacts--12 preserves the two
  // right-aligned helper lines -- they say what the field is FOR, which a
  // bare '· optional' suffix does not. The trailing '· optional' is folded
  // into this same helper string (lowercase, matching item 7's suffix
  // convention) rather than living as its own separate span.
  helper: string;
  children: ReactNode;
}

// w4-c: the enroll dialog's own field-row shell for FIT / WHY THEM -- keeps
// the shared FormRow's inline ' · optional' suffix (DEC-685/DEC-909) out of
// this one dialog and instead right-aligns the real helper line beside the
// label, on its own row within the chq-form-row shell FormRow already
// establishes (same label/control classes, so spacing matches).
function OptionalFieldRow({ label, htmlFor, helper, children }: OptionalFieldRowProps) {
  return (
    <div className="chq-form-row">
      <div className="chq-contacts-pipeline-field-head">
        <label className="chq-form-row-label" htmlFor={htmlFor}>
          {label}
        </label>
        <span className="chq-contacts-pipeline-field-optional">{helper}</span>
      </div>
      <div className="chq-form-row-control">{children}</div>
    </div>
  );
}

interface EnrollDialogProps {
  alreadyEnrolledContactIds: Set<string>;
  // Item 5: an empty stage's own "Add someone to <stage> ›" opens this
  // dialog preset to that stage, rather than always defaulting to the
  // first one.
  initialStage: PipelineStage;
  onClose: () => void;
  onEnrolled: () => void;
}

// w40-c/DEC-821 amendment: the enroll picker used to load /contacts?perPage=200
// once on mount and render every returned contact as an <option> -- past 200
// org contacts (routine at SPEC's 200-800 speakers plus a multi-year network)
// most of the directory was silently unreachable, with no search and no
// statement of the bound. This is the same server-search idiom
// SubmissionDetailPage's add-co-presenter search already uses
// (`/contacts?q=...`), never a second contacts-search predicate.
const PIPELINE_ENROLL_SEARCH_LIMIT = 20;

// DEC-856: the enroll writer's own known-field labels/anchors -- contactId,
// stage, fitScore, rationale all have a real control; `reason` (declining
// requires one, POST /pipeline validates it, but this dialog collects no
// reason control) and any other server-added key fall through to
// unmatchedFieldErrors and render labelled, in the summary, per rule 4.
const ENROLL_FIELD_LABELS: Record<string, string> = {
  contactId: 'Contact',
  stage: 'Starting stage',
  fitScore: 'Fit',
  rationale: 'Why them',
};
const ENROLL_FIELD_IDS: Record<string, string> = {
  contactId: 'pipeline-enroll-contact-search',
  stage: 'pipeline-enroll-stage-group',
  fitScore: 'pipeline-enroll-fit-group',
  rationale: 'pipeline-enroll-rationale',
};

function EnrollDialog({ alreadyEnrolledContactIds, initialStage, onClose, onEnrolled }: EnrollDialogProps) {
  const [contactId, setContactId] = useState('');
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const [stage, setStage] = useState<PipelineStage>(initialStage);
  // DEC-821: fit is optional at enroll time -- '' means "unrated", never a
  // silently-assumed score.
  const [fitScore, setFitScore] = useState('');
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);
  // DEC-856: the enroll writer's OWN field-error state -- never shared with
  // move/save-fit/save-note.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactListItem[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  async function searchContacts() {
    const q = query.trim();
    if (!q) {
      // An empty query renders no rows plus the search hint, never a list --
      // never re-fetches the whole directory.
      setResults([]);
      setResultsTotal(0);
      setSearched(false);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await apiList<ContactListItem>(
        `/contacts?q=${encodeURIComponent(q)}&perPage=${PIPELINE_ENROLL_SEARCH_LIMIT}`,
      );
      setResults(res.items);
      setResultsTotal(res.total);
      setSearched(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Contact search failed');
    } finally {
      setSearching(false);
    }
  }

  const available = results.filter((c) => !alreadyEnrolledContactIds.has(c.id));

  function selectContact(c: ContactListItem) {
    setContactId(c.id);
    setSelectedContact(c);
  }

  async function enroll() {
    if (!contactId) return;
    setBusy(true);
    setError(null);
    // DEC-856: cleared at the start of every attempt.
    setFieldErrors({});
    try {
      await apiPost('/pipeline', {
        contactId,
        stage,
        fitScore: fitScore === '' ? null : Number(fitScore),
        rationale: rationale.trim() === '' ? null : rationale.trim(),
      });
      onEnrolled();
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to enroll contact');
      }
    } finally {
      setBusy(false);
    }
  }

  const enrollProblems = fieldErrorProblems(fieldErrors, ENROLL_FIELD_LABELS, ENROLL_FIELD_IDS, 'pipeline-enroll-field');

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
          {/* w4-c: the no-email footnote moves below the button row -- a
              footnote to the action, not a warning above it. Item 8 (MINOR):
              the sentence starts uppercase, matching the frame. */}
          <p className="chq-contacts-pipeline-enroll-consequence">
            Adding writes a move to the activity feed · no email is sent
          </p>
        </>
      }
    >
      {error && <div className="chq-error">{error}</div>}
      {/* DEC-856: this dialog owns 4+ possible controls (Contact/Starting
          stage/Fit/Why them), so a refusal also gets the ONE ErrorSummary --
          one anchor per problem, unmatched keys (e.g. `reason` -- declining
          straight into 'declined' requires one, but this dialog collects no
          reason control) still listed, never dropped. */}
      {enrollProblems.length > 0 && (
        <ErrorSummary
          heading={countHeading(enrollProblems.length, 'before this contact can be added to the pipeline')}
          kept="Nothing was lost. Your typed values are still below."
          problems={enrollProblems}
        />
      )}
      <FormRow label="Contact" htmlFor="pipeline-enroll-contact-search">
        <div className="chq-contacts-pipeline-enroll-search">
          <input
            id="pipeline-enroll-contact-search"
            type="search"
            className="chq-input"
            aria-label="Search contacts"
            placeholder="Search by name, email or company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void searchContacts();
              }
            }}
          />
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={searching}
            onClick={() => void searchContacts()}
          >
            Search
          </button>
        </div>
        {query.trim() === '' && (
          <p className="chq-contacts-pipeline-enroll-search-hint">Search by name, email or company</p>
        )}
        {query.trim() !== '' && searched && available.length === 0 && (
          <p className="chq-contacts-pipeline-enroll-search-empty">No contacts found.</p>
        )}
        {available.length > 0 && (
          <ul className="chq-contacts-pipeline-enroll-search-results">
            {available.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`chq-contacts-pipeline-enroll-result${contactId === c.id ? ' is-selected' : ''}`}
                  aria-pressed={contactId === c.id}
                  onClick={() => selectContact(c)}
                >
                  {c.firstName} {c.lastName} — {c.email}
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* DEC-468 idiom: the bound is stated from the envelope's true
            total, never from items.length -- a search whose real match
            count exceeds the page cap says so and tells the user how to
            narrow it. */}
        {resultsTotal > results.length && (
          <p className="chq-contacts-pipeline-enroll-search-bound">
            Showing the first {results.length} of {resultsTotal} — narrow your search
          </p>
        )}
        {selectedContact && (
          <p className="chq-contacts-pipeline-enroll-selected">
            Selected: {selectedContact.firstName} {selectedContact.lastName} — {selectedContact.email}
          </p>
        )}
        {fieldErrors.contactId && (
          <span role="alert" className="chq-field-error">
            {fieldErrors.contactId}
          </span>
        )}
      </FormRow>
      <FormRow label="Starting stage">
        {/* w4-c: full pills, near-black selected fill -- the same
            .chq-pill/.is-active treatment the phone stage strip already
            uses (styles.css), not the segmented-button chip. */}
        <div id="pipeline-enroll-stage-group" className="chq-chipstrip" role="group" aria-label="Starting stage">
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
        {fieldErrors.stage && (
          <span role="alert" className="chq-field-error">
            {fieldErrors.stage}
          </span>
        )}
      </FormRow>
      <OptionalFieldRow label="Fit" helper="Ranks people within a stage · optional">
        {/* Item 8 (MINOR): frame 08-contacts--12 draws five equal boxes,
            1-5, with no sixth 'Unrated' option -- fit stays optional in the
            data model (DEC-821), so clicking the already-selected value
            clears it back to unrated rather than needing a dedicated box. */}
        <div id="pipeline-enroll-fit-group" className="chq-segmented" role="group" aria-label="Fit">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={fitScore === String(n) ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
              aria-pressed={fitScore === String(n)}
              onClick={() => setFitScore((prev) => (prev === String(n) ? '' : String(n)))}
            >
              {n}
            </button>
          ))}
        </div>
        {fieldErrors.fitScore && (
          <span role="alert" className="chq-field-error">
            {fieldErrors.fitScore}
          </span>
        )}
      </OptionalFieldRow>
      <OptionalFieldRow label="Why them" htmlFor="pipeline-enroll-rationale" helper="One line · shown on the card">
        <input
          id="pipeline-enroll-rationale"
          type="text"
          className="chq-input"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Keynoted a similar event last year"
          maxLength={PIPELINE_RATIONALE_MAX_LEN}
        />
        {fieldErrors.rationale && (
          <span role="alert" className="chq-field-error">
            {fieldErrors.rationale}
          </span>
        )}
      </OptionalFieldRow>
      {/* DEC-856: a key this dialog owns no control for (e.g. `reason` --
          declining straight into 'declined' needs one, but nothing here
          collects it) still renders, labelled, never dropped. */}
      {unmatchedFieldErrors(fieldErrors, ENROLL_FIELD_LABELS).map(([key, message]) => (
        <span key={key} id={`pipeline-enroll-field-${key}`} role="alert" className="chq-field-error">
          {`${key}: ${message}`}
        </span>
      ))}
    </ModalFrame>
  );
}

interface FitEditDialogProps {
  entry: PipelineEntry;
  onClose: () => void;
  onSave: (fitScore: number | null, rationale: string | null) => Promise<void>;
}

// DEC-856: the save-fit writer's own known-field labels/anchors -- two
// controls, so per rule 3 it also gets the ONE ErrorSummary.
const FIT_FIELD_LABELS: Record<string, string> = {
  fitScore: 'Fit',
  rationale: 'Why them',
};
const FIT_FIELD_IDS: Record<string, string> = {
  fitScore: 'pipeline-fit-edit-fit-group',
  rationale: 'pipeline-fit-edit-rationale',
};

// DEC-980: fit is editable after enrolment — the SAME two controls the
// enrol dialog uses (fit 1-5, optional; one-line 'Why them'), but this
// dialog never carries a stage control: it submits a fit-only PATCH
// (no `stage` key at all), so the route never treats it as a move.
function FitEditDialog({ entry, onClose, onSave }: FitEditDialogProps) {
  const [fitScore, setFitScore] = useState(entry.fitScore !== null ? String(entry.fitScore) : '');
  const [rationale, setRationale] = useState(entry.rationale ?? '');
  const [error, setError] = useState<string | null>(null);
  // DEC-856: the save-fit writer's OWN field-error state -- never shared
  // with move/enroll/save-note.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    // DEC-856: cleared at the start of every attempt.
    setFieldErrors({});
    try {
      await onSave(fitScore === '' ? null : Number(fitScore), rationale.trim() === '' ? null : rationale.trim());
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save fit');
      }
      setBusy(false);
    }
  }

  const fitProblems = fieldErrorProblems(fieldErrors, FIT_FIELD_LABELS, FIT_FIELD_IDS, 'pipeline-fit-edit-field');

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
      {/* DEC-856: two controls (Fit + Why them), so a refusal also gets the
          ONE ErrorSummary -- unmatched keys (e.g. `patch`, the form-level
          "must change stage, fitScore, or rationale" refusal, unreachable
          from this dialog since it always sends both) rendered labelled,
          never dropped. */}
      {fitProblems.length > 0 && (
        <ErrorSummary
          heading={countHeading(fitProblems.length, 'before this fit can be saved')}
          kept="Nothing was lost. Your typed values are still below."
          problems={fitProblems}
        />
      )}
      <FormRow label="Fit" optional>
        {/* Item 8 (MINOR): same five-box, no-sixth-'Unrated'-box control as
            the Add-to-the-pipeline dialog (frame 08-contacts--12) -- kept
            consistent across both fit controls. Fit stays optional
            (DEC-821): clicking the selected value again clears it. */}
        <div id="pipeline-fit-edit-fit-group" className="chq-segmented" role="group" aria-label="Fit">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={fitScore === String(n) ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
              aria-pressed={fitScore === String(n)}
              onClick={() => setFitScore((prev) => (prev === String(n) ? '' : String(n)))}
            >
              {n}
            </button>
          ))}
        </div>
        {fieldErrors.fitScore && (
          <span role="alert" className="chq-field-error">
            {fieldErrors.fitScore}
          </span>
        )}
      </FormRow>
      <FormRow label="Why them" htmlFor="pipeline-fit-edit-rationale" optional>
        <input
          id="pipeline-fit-edit-rationale"
          type="text"
          className="chq-input"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Keynoted a similar event last year"
          maxLength={PIPELINE_RATIONALE_MAX_LEN}
        />
        {fieldErrors.rationale && (
          <span role="alert" className="chq-field-error">
            {fieldErrors.rationale}
          </span>
        )}
      </FormRow>
      {/* DEC-856: a key this dialog owns no control for (e.g. `patch`)
          still renders, labelled, never dropped. */}
      {unmatchedFieldErrors(fieldErrors, FIT_FIELD_LABELS).map(([key, message]) => (
        <span key={key} id={`pipeline-fit-edit-field-${key}`} role="alert" className="chq-field-error">
          {`${key}: ${message}`}
        </span>
      ))}
    </ModalFrame>
  );
}

interface EntryDetailPanelProps {
  entryId: string;
  entry: PipelineEntry;
  moveError?: FieldErrors;
  onClose: () => void;
  onChanged: () => void;
  onMove: (stage: PipelineStage) => void;
  // Item 7: the card face carries no Edit control anymore (frame
  // 08-contacts--04) -- this panel, reached via the card's own name
  // button, is the click-target that keeps fit editing reachable.
  onEditFit: () => void;
}

// DEC-856: the note writer's own known-field label -- a single-control form
// (just `body`), so per DEC-856 rule 3 it gets an inline field error, never
// an ErrorSummary (that's reserved for forms with two or more controls).
const NOTE_FIELD_LABELS: Record<string, string> = { body: 'Note' };

// DEC-157 amendment (w2-b): the stage control lives here now, not on the
// desktop card -- `entry` is the board's live PipelineEntry (kept current by
// PipelineBoard's own setEntries on every move) so the select always shows
// the latest confirmed/optimistic stage without this panel duplicating the
// PATCH request itself.
function EntryDetailPanel({ entryId, entry, moveError, onClose, onChanged, onMove, onEditFit }: EntryDetailPanelProps) {
  const [detail, setDetail] = useState<PipelineEntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // DEC-856: the note writer's OWN field-error state -- a rejected note
  // never marks the fit form or the move control above it.
  const [noteFieldErrors, setNoteFieldErrors] = useState<FieldErrors>({});
  // DEC-468/w56-e: the activity feed's own page cap -- distinct state so
  // "Load more" can append without refetching the whole entry+contact.
  const [activityItems, setActivityItems] = useState<PipelineActivity[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);

  function reload() {
    setError(null);
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
    setError(null);
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
    // DEC-856: cleared at the start of every attempt.
    setNoteFieldErrors({});
    try {
      await apiPost(`/pipeline/${entryId}/notes`, { body: note.trim() });
      setNote('');
      await reload();
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setNoteFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save note');
      }
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
          {/* DEC-856: the same per-card move refusal, also attached to the
              real control that would carry it when the card's own detail
              panel is open. */}
          {moveError && Object.keys(moveError).length > 0 && (
            <div id="pipeline-detail-stage-error" className="chq-contacts-pipeline-move-error">
              {moveErrorMessages(moveError).map(({ key, text }) => (
                <span key={key} role="alert" className="chq-field-error">
                  {text}
                </span>
              ))}
            </div>
          )}

          {/* Item 7: the card face carries no fit-edit control anymore
              (frame 08-contacts--04) -- this detail panel, reached via the
              card's own name button, is where the fit-only PATCH dialog
              (DEC-980) is now triggered from, so the capability stays
              reachable without a per-card Edit link. */}
          <div className="chq-contacts-pipeline-detail-fit">
            <span className="chq-contacts-pipeline-detail-fit-label">Fit</span>
            {entry.fitScore !== null ? (
              <span className="chq-pill chq-contacts-pipeline-card-fit chq-contacts-pipeline-card-fit-rated">
                Fit {entry.fitScore}
              </span>
            ) : (
              <span className="chq-pill chq-contacts-pipeline-card-fit chq-contacts-pipeline-card-fit-unrated">
                Unrated
              </span>
            )}
            {entry.rationale && <span className="chq-contacts-pipeline-card-rationale">{entry.rationale}</span>}
            <button type="button" className="chq-link-button chq-contacts-pipeline-card-fit-edit" onClick={onEditFit}>
              {entry.fitScore !== null ? 'Edit fit' : 'Rate'}
            </button>
          </div>

          <div className="chq-contacts-pipeline-notes">
            <label className="chq-contacts-import-field" htmlFor="pipeline-detail-note">
              Add a note
              <textarea
                id="pipeline-detail-note"
                className="chq-textarea"
                maxLength={MAX_LONG_TEXT_LENGTH}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Followed up by phone, waiting on their reply"
              />
            </label>
            {/* DEC-856: the note writer's own field-error state -- a single
                control, so an inline span, never an ErrorSummary. Unmatched
                keys still render, labelled. */}
            {Object.entries(noteFieldErrors).map(([key, message]) => (
              <span key={key} id={`pipeline-detail-note-error-${key}`} role="alert" className="chq-field-error">
                {NOTE_FIELD_LABELS[key] ? `${NOTE_FIELD_LABELS[key]}: ${message}` : `${key}: ${message}`}
              </span>
            ))}
            <button type="button" className="chq-btn chq-btn-secondary" disabled={busy || note.trim() === ''} onClick={saveNote}>
              Save note
            </button>
          </div>

          <h4 className="chq-section-label">Activity</h4>
          {/* DEC-678: a card's activity feed has no filter/search axis of
              its own -- it is the entry's whole move+note history -- so a
              zero-row settle is always the 'fresh' voice. */}
          {activityItems.length === 0 ? (
            <EmptyState variant="fresh" what="No activity yet." action={null} />
          ) : (
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
            </ul>
          )}

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
