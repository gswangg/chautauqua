// Design pack v12, the task view: docs/design/Chautauqua Speakers.dc.html
// frames "One task, every speaker" (`Opened from a column head · where
// answers get read`) and "One task · still waiting" (`Same bar, different
// verbs`). One task across every speaker who holds it -- the third face of
// the same task_assignment join the onboarding grid (every task x every
// speaker) and the speaker detail (every task for one speaker) already
// show, reached from a grid column head.
//
// Two tabs over ONE payload (GET /api/v1/tasks/:id/roster), one bar whose
// verbs change with the tab. Everything the page can do is an existing
// endpoint: the status toggles are the same PATCH /task-assignments/:id the
// grid uses, the reminders are the same task-scoped POST
// /events/:eventId/onboarding/remind pair, and "Move the due date" is PATCH
// /tasks/:id -- v12 deliberately offers no per-speaker due date
// (DESIGN-RULINGS.md, "A per-selection due date is not worth its cost": a
// due date lives on the task, and the two outcomes that get the value
// without forking the model are moving the date for the whole task and
// marking it not needed for the individuals it does not apply to).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPatch, apiPost, ApiError } from '../../lib/api';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { DateField } from '../../components/DateField';
import { RemindPreviewModal } from './RemindPreviewModal';
import { ResponseModal } from './ResponseModal';
import { formatDueDate, OVERDUE_LABEL, statusCellClass } from './TaskCell';
import { countOf } from '../../lib/plural';
import { dateInputToMs, formatDate, formatRelativeDays, msToDateInput } from '../../lib/dates';
import { describeSendResult, failureLines, type SendResult } from '../../lib/sendResult';
import type { AssignmentResponseDetail, AssignmentStatus, ReminderDraft } from './types';
import { isAnswered, type TaskViewResponse, type TaskViewRow } from './taskRoster';
// The ONE CSV writer in the codebase (src/domain/csv.ts, pure core) --
// crossed the app/ -> src/ boundary with a direct relative import, the same
// idiom TaskCell.tsx uses for src/domain/task-due.ts.
import { toCsv } from '../../../../src/domain/csv';
// The status chips on this page are the SHARED .chq-speakers-status family
// (statusCellClass above), which lives in speakers.css -- without this import
// the route loads its own stylesheet only, and every OVERDUE renders as plain
// text instead of v12's filled ink mark. The other two speakers surfaces
// (Speakers.tsx, SpeakerDetailPage.tsx) each import it for the same reason.
import './speakers.css';
import './task-view.css';

type Tab = 'answered' | 'waiting';

/** "3 sends · last 4 Aug" / "1 send · 4 Aug" / "Never" -- the frame's Last
 * reminded column. `remindCount` is how many reminder emails NAMED this
 * task to this speaker; `lastRemindedAt` is the assignment's own dedupe
 * stamp. A stamp with no matching log rows is reported as the date alone
 * rather than as a count this page cannot stand behind. */
export function remindedLabel(row: TaskViewRow): string {
  if (row.lastRemindedAt === null) return 'Never';
  const when = formatDate(row.lastRemindedAt);
  if (row.remindCount === 0) return `Reminded ${when}`;
  if (row.remindCount === 1) return `1 send · ${when}`;
  return `${countOf(row.remindCount, 'send')} · last ${when}`;
}

/** The waiting tab's "Where it stands". The frame's samples name a portal
 * visit (`Nothing yet · opened her portal 6 Aug`); this product has no
 * portal-visit tracking -- auth_session carries only user/token/expiry, and
 * a speaker with no account never has a row at all -- so the honest form
 * states what IS known: nothing has arrived, and when the task landed on
 * them. Never a fabricated visit date. */
export function standingLabel(row: TaskViewRow, now: number): string {
  const assigned = formatRelativeDays(row.assignedAt, now);
  if (row.fileId !== null) return `A file is in, the task is not marked done · assigned ${assigned}`;
  return `Nothing yet · assigned ${assigned}`;
}

/** The exception register (11px/800/0.09em uppercase) marks the ONE row a
 * column is about, never every row -- the same weight-goes-to-the-exception
 * rule the grid's inverted status vocabulary follows. In Last reminded that
 * is the most-chased speaker; in Answered it is an answer that landed
 * today. */
function emphasisClass(isException: boolean): string {
  return isException ? 'chq-taskview-emph' : 'chq-taskview-quiet';
}

export function TaskView() {
  const { taskId } = useParams<{ taskId: string }>();
  const [view, setView] = useState<TaskViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('answered');
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);

  // "Move the due date" -- the WHOLE task's date, per DESIGN-RULINGS.
  // Reuses the app's one date-entry grammar (DateField) inside the one
  // dialog frame (ModalFrame), never a new control family.
  const [movingDue, setMovingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState('');
  const [savingDue, setSavingDue] = useState(false);

  // "Not needed" removes a real row, so it is confirmed and names exactly
  // who loses the task.
  const [pendingNotNeeded, setPendingNotNeeded] = useState<readonly string[] | null>(null);

  // The same review-before-send reminder flow the grid and the speaker
  // detail use, scoped here to THIS task via taskIds.
  const [remindScope, setRemindScope] = useState<readonly string[] | null>(null);
  const [remindDrafts, setRemindDrafts] = useState<ReminderDraft[] | null>(null);
  const [remindPreviewLoading, setRemindPreviewLoading] = useState(false);
  const [remindPreviewError, setRemindPreviewError] = useState<string | null>(null);
  const [remindSkipped, setRemindSkipped] = useState(0);
  const [remindRemaining, setRemindRemaining] = useState(0);
  const [reminding, setReminding] = useState(false);

  // The answered tab's `Open` action -- DEC-291's response viewer, which
  // this page now owns (the grid's per-cell Response link is gone in v12).
  const [openRow, setOpenRow] = useState<TaskViewRow | null>(null);
  const [responseDetail, setResponseDetail] = useState<AssignmentResponseDetail | null>(null);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  const now = Date.now();

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      setView(await apiGet<TaskViewResponse>(`/tasks/${taskId}/roster`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load this task');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => view?.rows ?? [], [view]);
  const answeredRows = useMemo(() => rows.filter(isAnswered), [rows]);
  const waitingRows = useMemo(() => rows.filter((r) => !isAnswered(r)), [rows]);
  const tabRows = tab === 'answered' ? answeredRows : waitingRows;

  const totalSends = rows.reduce((sum, r) => sum + r.remindCount, 0);
  const lastSentAt = rows.reduce<number | null>(
    (latest, r) => (r.lastRemindedAt !== null && (latest === null || r.lastRemindedAt > latest) ? r.lastRemindedAt : latest),
    null,
  );
  const mostReminded = waitingRows.reduce((max, r) => Math.max(max, r.remindCount), 0);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = tabRows.filter((r) => selectedSet.has(r.contactId));

  function switchTab(next: Tab) {
    setTab(next);
    setSelected([]);
  }

  function toggleRow(contactId: string) {
    setSelected((prev) => (prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]));
  }

  function toggleAll() {
    setSelected((prev) => (prev.length === tabRows.length ? [] : tabRows.map((r) => r.contactId)));
  }

  async function setStatusForSelected(status: AssignmentStatus) {
    setBusy(true);
    setError(null);
    try {
      for (const row of selectedRows) {
        if (row.status === status) continue;
        await apiPatch(`/task-assignments/${row.assignmentId}`, { status });
      }
      setSelected([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  // docs/design/Chautauqua Speakers.dc.html:656 `Exporting sends the
  // selected answers as a CSV · nothing is emailed to the speakers` -- so
  // the export is built here, from the rows already on screen, and touches
  // no send path at all.
  function exportRows(exported: readonly TaskViewRow[]) {
    if (!view) return;
    const csv = toCsv([
      ['Speaker', 'Company', 'Answers', 'Answered'],
      ...exported.map((r) => [r.name, r.company ?? '', r.answerSummary ?? r.fileName ?? '', formatDate(r.completedAt)]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${view.task.title.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-answers.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function saveDueDate() {
    if (!taskId) return;
    setSavingDue(true);
    setError(null);
    try {
      await apiPatch(`/tasks/${taskId}`, { dueDate: dateInputToMs(dueDraft) });
      setMovingDue(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
    } finally {
      setSavingDue(false);
    }
  }

  async function removeNotNeeded(contactIds: readonly string[]) {
    if (!taskId) return;
    setBusy(true);
    setError(null);
    try {
      const refreshed = await apiPost<TaskViewResponse>(`/tasks/${taskId}/unassign`, { contactIds: [...contactIds] });
      setView(refreshed);
      setSelected([]);
      setPendingNotNeeded(null);
      setToast(`${countOf(contactIds.length, 'speaker')} no longer need this task.`);
    } catch (err) {
      setError(err instanceof ApiError ? `Removal failed: ${err.message}` : 'Removal failed');
      setPendingNotNeeded(null);
    } finally {
      setBusy(false);
    }
  }

  // docs/design/Chautauqua Speakers.dc.html:697 `A reminder names only this
  // task · skips anyone emailed in the last hour · the due date moves for
  // everyone, from the header` -- all three clauses are load-bearing, not
  // decoration: taskIds scopes the email body to this one task
  // (formatTaskLines), and planManualReminders' MANUAL_DEDUPE_WINDOW_MS is
  // exactly one hour.
  async function openRemindReview(contactIds: readonly string[]) {
    if (!view) return;
    setRemindScope(contactIds);
    setRemindPreviewLoading(true);
    setRemindPreviewError(null);
    setRemindDrafts(null);
    setRemindSkipped(0);
    setRemindRemaining(0);
    try {
      const res = await apiPost<{ drafts: ReminderDraft[]; skipped: number; remaining: number }>(
        `/events/${view.task.eventId}/onboarding/remind/preview`,
        { taskIds: [view.task.id], contactIds: [...contactIds] },
      );
      setRemindDrafts(res.drafts);
      setRemindSkipped(res.skipped);
      setRemindRemaining(res.remaining);
    } catch (err) {
      setRemindPreviewError(err instanceof ApiError ? err.message : 'Failed to load reminder preview');
    } finally {
      setRemindPreviewLoading(false);
    }
  }

  function closeRemindReview() {
    setRemindScope(null);
    setRemindDrafts(null);
    setRemindPreviewError(null);
    setRemindSkipped(0);
    setRemindRemaining(0);
  }

  async function sendReminders() {
    if (!view || remindScope === null) return;
    setReminding(true);
    setError(null);
    try {
      const res = await apiPost<SendResult>(`/events/${view.task.eventId}/onboarding/remind`, {
        taskIds: [view.task.id],
        contactIds: [...remindScope],
      });
      const lines = failureLines(res);
      setToast(`${describeSendResult(res, { one: 'speaker', many: 'speakers' })}${lines ? ` ${lines}.` : ''}`);
      closeRemindReview();
      setSelected([]);
      await load();
    } catch (err) {
      setRemindPreviewError(err instanceof ApiError ? `Send failed: ${err.message}` : 'Send failed');
    } finally {
      setReminding(false);
    }
  }

  async function openResponse(row: TaskViewRow) {
    setOpenRow(row);
    setResponseDetail(null);
    setResponseError(null);
    setResponseLoading(true);
    try {
      setResponseDetail(await apiGet<AssignmentResponseDetail>(`/task-assignments/${row.assignmentId}/response`));
    } catch (err) {
      setResponseError(err instanceof ApiError ? err.message : 'Failed to load this response');
    } finally {
      setResponseLoading(false);
    }
  }

  async function reopenFromResponse(status: AssignmentStatus) {
    if (!openRow) return;
    setError(null);
    try {
      await apiPatch(`/task-assignments/${openRow.assignmentId}`, { status });
      setOpenRow(null);
      setResponseDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? `Update failed: ${err.message}` : 'Update failed');
    }
  }

  if (loading) {
    return (
      <div className="chq-page chq-taskview-page chq-measure-table">
        <PageSkeleton variant="table" label="Loading this task…" />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="chq-page chq-taskview-page chq-measure-table">
        <h1 className="chq-page-title">Task</h1>
        <div className="chq-error">{error ?? 'Task not found.'}</div>
      </div>
    );
  }

  const { task, counts } = view;
  // docs/design/Chautauqua Speakers.dc.html:614 `Due 15 Aug · required · 6
  // answered of 9 who need it`
  const subLine = [
    task.dueDate === null ? 'No due date' : `Due ${formatDueDate(task.dueDate, now)}`,
    ...(task.required ? ['required'] : []),
    `${counts.answered} answered of ${counts.assigned} who need it`,
  ].join(' · ');

  return (
    <div className="chq-page chq-taskview-page chq-measure-table">
      {error && <div className="chq-error">{error}</div>}
      {toast && (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <div className="chq-taskview-head">
        <div className="chq-taskview-titles">
          <Link className="chq-link-button chq-taskview-back" to="/speakers">
            &lsaquo; Speakers
          </Link>
          <h1 className="chq-page-title chq-taskview-title">{task.title}</h1>
          <span className="chq-taskview-sub">{subLine}</span>
        </div>
        <div className="chq-taskview-actions">
          {tab === 'answered' && (
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => exportRows(answeredRows)}
              disabled={answeredRows.length === 0}
            >
              Export answers
            </button>
          )}
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            onClick={() => {
              setDueDraft(msToDateInput(task.dueDate));
              setMovingDue(true);
            }}
          >
            Move the due date
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            onClick={() => void openRemindReview(waitingRows.map((r) => r.contactId))}
            disabled={waitingRows.length === 0}
          >
            {tab === 'answered' ? 'Remind the missing' : 'Remind all waiting'}
          </button>
        </div>
      </div>

      <div className="chq-taskview-tabs">
        <button
          type="button"
          className={tab === 'answered' ? 'chq-taskview-tab chq-taskview-tab-on' : 'chq-taskview-tab'}
          aria-pressed={tab === 'answered'}
          onClick={() => switchTab('answered')}
        >
          Answered &middot; {answeredRows.length}
        </button>
        <button
          type="button"
          className={tab === 'waiting' ? 'chq-taskview-tab chq-taskview-tab-on' : 'chq-taskview-tab'}
          aria-pressed={tab === 'waiting'}
          onClick={() => switchTab('waiting')}
        >
          Still waiting &middot; {waitingRows.length}
        </button>
        <span className="chq-taskview-tabmeta">
          {lastSentAt === null
            ? 'No reminders sent'
            : `${countOf(totalSends, 'reminder send')} · last ${formatDate(lastSentAt)}`}
        </span>
      </div>

      {selected.length > 0 && (
        <div className="chq-bulkbar">
          <span className="chq-bulkbar-count chq-taskview-bulk-count">{selected.length} selected</span>
          <span className="chq-bulkbar-note chq-taskview-bulk-note">
            {tab === 'answered'
              ? 'Marking complete sends nothing'
              : 'A reminder names only this task · skips anyone emailed in the last hour · the due date moves for everyone, from the header'}
          </span>
          <div className="chq-bulkbar-actions">
            {tab === 'answered' ? (
              <>
                <button
                  type="button"
                  className="chq-btn chq-btn-primary"
                  onClick={() => void setStatusForSelected('complete')}
                  disabled={busy}
                >
                  Mark complete
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  onClick={() => void setStatusForSelected('pending')}
                  disabled={busy}
                >
                  Reopen
                </button>
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => exportRows(selectedRows)}>
                  Export
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="chq-btn chq-btn-primary"
                  onClick={() => void openRemindReview(selected)}
                  disabled={busy}
                >
                  Remind
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  onClick={() => setPendingNotNeeded(selected)}
                  disabled={busy}
                >
                  Not needed
                </button>
              </>
            )}
            <button type="button" className="chq-link-button chq-taskview-clear" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      {tabRows.length === 0 ? (
        <EmptyState
          variant="filtered"
          what={tab === 'answered' ? 'No answers yet.' : 'Nobody is still waiting.'}
          reason={
            tab === 'answered'
              ? 'Every speaker who needs this task is still waiting.'
              : 'Every speaker who needs this task has answered.'
          }
          escape={{
            label: tab === 'answered' ? 'See who is still waiting ›' : 'See the answers ›',
            onClick: () => switchTab(tab === 'answered' ? 'waiting' : 'answered'),
          }}
        />
      ) : (
        <div
          className={tab === 'answered' ? 'chq-taskview-answers' : 'chq-taskview-waiting'}
          role="table"
          aria-label={tab === 'answered' ? 'Answers' : 'Still waiting'}
        >
          <div className="chq-taskview-head-row" role="row">
            <span role="columnheader">
              <input
                type="checkbox"
                className="chq-check chq-taskview-check"
                checked={selected.length === tabRows.length}
                onChange={toggleAll}
                aria-label={tab === 'answered' ? 'Select every answer' : 'Select everyone still waiting'}
              />
            </span>
            <span role="columnheader">Speaker</span>
            <span role="columnheader">{tab === 'answered' ? 'Their answers' : 'Where it stands'}</span>
            <span role="columnheader">{tab === 'answered' ? 'Answered' : 'Last reminded'}</span>
            <span role="columnheader">{tab === 'answered' ? '' : 'Status'}</span>
          </div>

          {tabRows.map((row) => {
            const answeredToday = row.completedAt !== null && formatRelativeDays(row.completedAt, now) === 'today';
            const isMostReminded = row.remindCount > 0 && row.remindCount === mostReminded;
            return (
              <div className="chq-taskview-row" role="row" key={row.contactId}>
                <span role="cell">
                  <input
                    type="checkbox"
                    className="chq-check chq-taskview-check"
                    checked={selectedSet.has(row.contactId)}
                    onChange={() => toggleRow(row.contactId)}
                    aria-label={`Select ${row.name}`}
                  />
                </span>
                <span className="chq-taskview-speaker" role="cell">
                  <Link className="chq-taskview-name" to={`/speakers/${row.contactId}`}>
                    {row.name}
                  </Link>
                  <span className="chq-taskview-company">{row.company ?? '—'}</span>
                </span>
                {tab === 'answered' ? (
                  <span className="chq-taskview-answer" role="cell">
                    {row.answerSummary ?? row.fileName ?? 'Marked complete — no answers were recorded'}
                  </span>
                ) : (
                  <span className="chq-taskview-standing" role="cell">
                    {standingLabel(row, now)}
                  </span>
                )}
                {tab === 'answered' ? (
                  <span className={emphasisClass(answeredToday)} role="cell">
                    {answeredToday ? 'Today' : formatDate(row.completedAt)}
                  </span>
                ) : (
                  <span className={emphasisClass(isMostReminded)} role="cell">
                    {remindedLabel(row)}
                  </span>
                )}
                {tab === 'answered' ? (
                  <span role="cell">
                    <button type="button" className="chq-link-button chq-taskview-open" onClick={() => void openResponse(row)}>
                      Open
                    </button>
                  </span>
                ) : (
                  <span role="cell">
                    <span className={statusCellClass(row.status, row.overdue, 'roomy')}>
                      {row.overdue ? OVERDUE_LABEL : 'Pending'}
                    </span>
                  </span>
                )}
              </div>
            );
          })}

          <div className="chq-taskview-foot">
            {tab === 'answered'
              ? 'Exporting sends the selected answers as a CSV · nothing is emailed to the speakers'
              : 'Marking a task not needed removes it for that speaker only · it stays on everyone else'}
          </div>
        </div>
      )}

      {movingDue && (
        <ModalFrame
          title="Move the due date"
          subtitle="One date for the whole task — every speaker who holds it moves together"
          onClose={() => setMovingDue(false)}
          closeDisabled={savingDue}
          actions={
            <>
              <button type="button" className="chq-btn chq-btn-primary" onClick={() => void saveDueDate()} disabled={savingDue}>
                {savingDue ? 'Saving…' : 'Move the due date'}
              </button>
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                onClick={() => setMovingDue(false)}
                disabled={savingDue}
              >
                Cancel
              </button>
            </>
          }
        >
          <FormRow label="Due date" htmlFor="taskview-due-date" optional>
            <DateField id="taskview-due-date" value={dueDraft} onChange={setDueDraft} />
          </FormRow>
        </ModalFrame>
      )}

      {pendingNotNeeded && (
        <ConfirmDialog
          title="Not needed for these speakers"
          body={
            <>
              <p>
                {rows
                  .filter((r) => pendingNotNeeded.includes(r.contactId))
                  .map((r) => r.name)
                  .join(', ')}
              </p>
              <p>
                Marking a task not needed removes it for that speaker only &middot; it stays on everyone else. Their
                answers and any file on this task go with it.
              </p>
            </>
          }
          confirmLabel="Remove this task"
          pending={busy}
          onConfirm={() => void removeNotNeeded(pendingNotNeeded)}
          onCancel={() => setPendingNotNeeded(null)}
        />
      )}

      {remindScope !== null && (
        <RemindPreviewModal
          loading={remindPreviewLoading}
          error={remindPreviewError}
          drafts={remindDrafts}
          skipped={remindSkipped}
          remaining={remindRemaining}
          sending={reminding}
          onSend={() => void sendReminders()}
          onCancel={closeRemindReview}
        />
      )}

      {openRow && (
        <ResponseModal
          contactName={openRow.name}
          loading={responseLoading}
          error={responseError}
          detail={responseDetail}
          onStatusChange={(status) => void reopenFromResponse(status)}
          onClose={() => {
            setOpenRow(null);
            setResponseDetail(null);
            setResponseError(null);
          }}
        />
      )}
    </div>
  );
}
