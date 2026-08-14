// Session delete (DEC-886/DEC-921): a guarded cascade behind a confirmation
// PAGE, mirroring MergePage.tsx's "irreversible action gets a page, not a
// modal" convention -- the ids to delete travel in the query string
// (?ids=<id>,<id>[,...]) so the page survives a reload and can be
// linked/bookmarked. POST /events/:eventId/submissions/delete is
// set-based -- every id goes in ONE request; a submission with at least
// one submitted evaluation comes back refused, named with its reason,
// never a whole-batch failure.
//
// DEC-921: deleting a session takes its agenda placement with it and
// REOPENS (never destroys) any task response one of its files completed.
// The confirmation page must name what goes with each session BEFORE the
// organiser can press anything -- so it reads a single delete-plan (one
// grouped-query response, not a Promise.all waterfall over per-id detail
// fetches) that carries, per eligible submission, the blast-radius counts
// and whether it currently holds an agenda slot; and refused rows arrive
// pre-named in the same response, not only after the POST comes back.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import './submissions.css';

interface DeletePlanCounts {
  files: number;
  comments: number;
  participants: number;
  answers: number;
  tracks: number;
  recusals: number;
  revisions: number;
  taskResponses: number;
  reviewAssignments: number;
}

interface DeletePlanEligible {
  submissionId: string;
  ref: string;
  title: string;
  counts: DeletePlanCounts;
  scheduled: boolean;
}

interface DeleteRefusal {
  id: string;
  ref: string;
  reason: string;
}

interface DeletePlan {
  eligible: DeletePlanEligible[];
  refused: DeleteRefusal[];
}

/** DEC-921/DEC-925: one grammar for "N nouns" -- the printed number always
 * agrees with the noun it names. */
function countPhrase(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** DEC-921: the blast-radius fragments for one eligible session, in the
 * order they read as a sentence. Only non-zero counts (and a scheduled
 * slot) show -- an empty cascade says nothing extra. */
function blastRadiusParts(item: DeletePlanEligible): string[] {
  const parts: string[] = [];
  if (item.counts.files > 0) parts.push(countPhrase(item.counts.files, 'file', 'files'));
  if (item.counts.participants > 0) {
    parts.push(countPhrase(item.counts.participants, 'co-presenter', 'co-presenters'));
  }
  if (item.counts.answers > 0) parts.push(countPhrase(item.counts.answers, 'answer', 'answers'));
  if (item.counts.revisions > 0) parts.push(countPhrase(item.counts.revisions, 'revision', 'revisions'));
  if (item.counts.recusals > 0) {
    parts.push(countPhrase(item.counts.recusals, 'reviewer recusal', 'reviewer recusals'));
  }
  if (item.counts.reviewAssignments > 0) {
    parts.push(countPhrase(item.counts.reviewAssignments, 'review assignment', 'review assignments'));
  }
  if (item.scheduled) parts.push('leaves the agenda');
  if (item.counts.taskResponses > 0) {
    parts.push(`${countPhrase(item.counts.taskResponses, 'task response', 'task responses')} reopen`);
  }
  return parts;
}

export function DeleteSubmissionsPage() {
  const { eventId } = useCurrentEvent();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const idsParam = searchParams.get('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');

  const [eligible, setEligible] = useState<DeletePlanEligible[]>([]);
  const [refused, setRefused] = useState<DeleteRefusal[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  useEffect(() => {
    if (ids.length === 0 || !eventId) return;
    setLoading(true);
    setLoadError(null);
    apiGet<DeletePlan>(`/events/${eventId}/submissions/delete-plan?ids=${ids.join(',')}`)
      .then((plan) => {
        setEligible(plan.eligible);
        setRefused(plan.refused);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load the selected sessions'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam, eventId]);

  async function doDelete() {
    if (!eventId || eligible.length === 0) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const idsToDelete = eligible.map((item) => item.submissionId);
      const result = await apiPost<{ deleted: number; refused: DeleteRefusal[] }>(
        `/events/${eventId}/submissions/delete`,
        { ids: idsToDelete },
      );
      setDeletedCount(result.deleted);
      setRefused(result.refused);
      setConfirmOpen(false);
      if (result.refused.length === 0) {
        navigate('/submissions', {
          state: { notice: `${countPhrase(result.deleted, 'session', 'sessions')} deleted.` },
        });
      } else {
        const refusedIds = new Set(result.refused.map((r) => r.id));
        setEligible((prev) => prev.filter((item) => !refusedIds.has(item.submissionId)));
      }
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Delete failed');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const backLink = (
    <Link to="/submissions" className="chq-submissions-delete-back">
      &lsaquo; Submissions
    </Link>
  );

  if (ids.length === 0) {
    return (
      <div className="chq-page chq-submissions-delete-page chq-measure">
        <div className="chq-submissions-delete-topbar">{backLink}</div>
        <p className="chq-empty">No sessions selected. Pick sessions to delete from the Submissions list.</p>
      </div>
    );
  }

  const deleteCount = eligible.length;

  return (
    <div className="chq-page chq-submissions-delete-page chq-measure">
      <div className="chq-submissions-delete-topbar">{backLink}</div>
      <h1 className="chq-page-title">Delete sessions</h1>

      {loading && <DelayedLoading />}
      {!loading && loadError && <div className="chq-error">{loadError}</div>}
      {deleteError && <div className="chq-error">{deleteError}</div>}

      {!loading && !loadError && (
        <>
          <p className="chq-submissions-delete-intro">
            Deleting a session removes its answers, track assignments, co-presenters, uploaded files (and their
            stored copies), file comments, reviewer recusals, and content revision history. A scheduled session
            leaves the agenda. A task response completed with one of its files is reopened, not destroyed: the
            task stays on the speaker's list and its uploaded answer goes. Its history in the communications log
            is kept. This can't be undone.
          </p>

          <ul className="chq-submissions-delete-list">
            {eligible.map((item) => {
              const parts = blastRadiusParts(item);
              return (
                <li key={item.submissionId} className="chq-submissions-delete-list-item">
                  <div>
                    <span className="chq-submissions-delete-list-ref">{item.ref}</span>
                    <span className="chq-submissions-delete-list-title">{item.title}</span>
                  </div>
                  {parts.length > 0 && (
                    <div className="chq-submissions-delete-list-blast">{parts.join(', ')}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {refused.length > 0 && (
            <div className="chq-submissions-delete-refused">
              <p>
                {deletedCount !== null
                  ? `${countPhrase(deletedCount, 'session', 'sessions')} deleted. ${countPhrase(refused.length, 'session', 'sessions')} refused:`
                  : `${countPhrase(refused.length, 'session', 'sessions')} can't be deleted:`}
              </p>
              <ul>
                {refused.map((r) => (
                  <li key={r.id}>
                    <span className="chq-submissions-delete-list-ref">{r.ref}</span> — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="chq-submissions-delete-footer">
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              disabled={busy || deleteCount === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Delete {countPhrase(deleteCount, 'session', 'sessions')}
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => navigate('/submissions')}
            >
              Cancel
            </button>
          </div>

          {confirmOpen && (
            <ConfirmDialog
              title="Delete these sessions?"
              body="Everything they own is removed permanently. This can't be undone."
              confirmLabel={`Delete ${countPhrase(deleteCount, 'session', 'sessions')}`}
              destructive
              pending={busy}
              onConfirm={doDelete}
              onCancel={() => setConfirmOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
