// Session delete (DEC-886): a guarded cascade behind a confirmation PAGE,
// mirroring MergePage.tsx's "irreversible action gets a page, not a modal"
// convention -- the ids to delete travel in the query string
// (?ids=<id>,<id>[,...]) so the page survives a reload and can be
// linked/bookmarked. POST /events/:eventId/submissions/delete is
// set-based -- every id goes in ONE request; a submission with at least
// one submitted evaluation comes back refused, named with its reason,
// never a whole-batch failure.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import './submissions.css';

interface SubmissionSummary {
  id: string;
  ref: string;
  title: string;
}

interface DeleteRefusal {
  id: string;
  ref: string;
  reason: string;
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

  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [refused, setRefused] = useState<DeleteRefusal[]>([]);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
    setLoading(true);
    setLoadError(null);
    Promise.all(
      ids.map((id) =>
        apiGet<{ id: string; ref: string; title: string }>(`/submissions/${id}`).then((detail) => ({
          id: detail.id,
          ref: detail.ref,
          title: detail.title,
        })),
      ),
    )
      .then((res) => setItems(res))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load the selected sessions'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  async function doDelete() {
    if (!eventId || ids.length === 0) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const result = await apiPost<{ deleted: number; refused: DeleteRefusal[] }>(
        `/events/${eventId}/submissions/delete`,
        { ids },
      );
      setDeletedCount(result.deleted);
      setRefused(result.refused);
      setConfirmOpen(false);
      if (result.refused.length === 0) {
        navigate('/submissions', { state: { notice: `${result.deleted} sessions deleted.` } });
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
      <div className="chq-page chq-submissions-delete-page">
        <div className="chq-submissions-delete-topbar">{backLink}</div>
        <p className="chq-empty">No sessions selected. Pick sessions to delete from the Submissions list.</p>
      </div>
    );
  }

  const refusedIds = new Set(refused.map((r) => r.id));
  const stillEligible = items.filter((item) => !refusedIds.has(item.id));

  return (
    <div className="chq-page chq-submissions-delete-page">
      <div className="chq-submissions-delete-topbar">{backLink}</div>
      <h1 className="chq-page-title">Delete sessions</h1>

      {loading && <DelayedLoading />}
      {!loading && loadError && <div className="chq-error">{loadError}</div>}
      {deleteError && <div className="chq-error">{deleteError}</div>}

      {!loading && !loadError && (
        <>
          <p className="chq-submissions-delete-intro">
            Deleting a session removes its answers, track assignments, co-presenters, uploaded files (and their
            stored copies), file comments, reviewer recusals, and content revision history. Its history in the
            communications log is kept. This can't be undone.
          </p>

          <ul className="chq-submissions-delete-list">
            {items.map((item) => (
              <li key={item.id} className="chq-submissions-delete-list-item">
                <span className="chq-submissions-delete-list-ref">{item.ref}</span>
                <span className="chq-submissions-delete-list-title">{item.title}</span>
              </li>
            ))}
          </ul>

          {refused.length > 0 && (
            <div className="chq-submissions-delete-refused">
              <p>
                {deletedCount !== null
                  ? `${deletedCount} of ${items.length} deleted. ${refused.length} refused:`
                  : `${refused.length} of ${items.length} can't be deleted:`}
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
              disabled={busy || stillEligible.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Delete {deletedCount !== null ? stillEligible.length : items.length} sessions
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
              confirmLabel={`Delete ${items.length} sessions`}
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
