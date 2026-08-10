// Admin submission detail page (DEC-045). SPA-only: consumes existing
// GET /api/v1/submissions/:id, the DEC-016 forms + tracks endpoints, and
// the existing bulk status endpoint (ids:[id]) — no new server code.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import type { CfpForm } from '../forms/types';
import { buildAnswerRows, resolveAnswerFields } from './detailRows';
import { STATUS_LABELS, SUBMISSION_STATUSES, type SubmissionDetail, type SubmissionStatus, type Track } from './types';

function formatDate(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleString();
}

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [form, setForm] = useState<CfpForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<SubmissionDetail>(`/submissions/${id}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submission'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!detail) return;
    apiList<Track>(`/events/${detail.eventId}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
    apiGet<CfpForm>(`/events/${detail.eventId}/forms`)
      .then(setForm)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load form fields'));
    // Deliberately keyed on detail.eventId only: re-runs when a clone
    // navigates to a new submission in a different (or the same) event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.eventId]);

  async function changeStatus(status: SubmissionStatus) {
    if (!detail || !id) return;
    const previous = detail;
    setStatusPending(true);
    setError(null);
    // Optimistic update.
    setDetail({ ...detail, status });
    try {
      await apiPost<{ updated: number }>(`/events/${detail.eventId}/submissions/status`, {
        ids: [id],
        status,
      });
    } catch (err) {
      // Loud rollback: restore prior state and surface the failure.
      setDetail(previous);
      setError(err instanceof ApiError ? `Status update failed: ${err.message}` : 'Status update failed');
    } finally {
      setStatusPending(false);
    }
  }

  async function cloneSubmission() {
    if (!id) return;
    setCloning(true);
    setError(null);
    try {
      const cloned = await apiPost<SubmissionDetail>(`/submissions/${id}/clone`);
      navigate(`/submissions/${cloned.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? `Clone failed: ${err.message}` : 'Clone failed');
    } finally {
      setCloning(false);
    }
  }

  if (loading) {
    return (
      <div className="chq-page chq-submission-detail-page">
        <Link to="/submissions">&larr; Back to submissions</Link>
        <p>Loading...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="chq-page chq-submission-detail-page">
        <Link to="/submissions">&larr; Back to submissions</Link>
        {error && <div className="chq-error-banner">{error}</div>}
        {!error && <p>Submission not found.</p>}
      </div>
    );
  }

  const trackNames = detail.trackIds.map((trackId) => tracks.find((t) => t.id === trackId)?.name ?? trackId);
  const answerRows = buildAnswerRows(detail.answers, resolveAnswerFields(form, detail.formId));

  return (
    <div className="chq-page chq-submission-detail-page">
      <Link to="/submissions">&larr; Back to submissions</Link>

      <h1>
        {detail.ref}: {detail.title}
      </h1>

      {error && <div className="chq-error-banner">{error}</div>}

      <div className="chq-submission-detail-toolbar">
        <label>
          Status
          <select
            value={detail.status}
            disabled={statusPending}
            onChange={(e) => changeStatus(e.target.value as SubmissionStatus)}
          >
            {SUBMISSION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <span className="chq-content-status">Content: {detail.contentStatus}</span>
        <button type="button" disabled={cloning} onClick={cloneSubmission}>
          Clone
        </button>
      </div>

      {detail.description && (
        <section>
          <h2>Description</h2>
          <p>{detail.description}</p>
        </section>
      )}

      <section>
        <h2>Tracks</h2>
        {trackNames.length === 0 ? (
          <p>No tracks assigned.</p>
        ) : (
          <ul className="chq-track-chips">
            {trackNames.map((name, i) => (
              <li key={detail.trackIds[i]} className="chq-track-chip">
                {name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Participants</h2>
        {detail.participants.length === 0 ? (
          <p>No participants.</p>
        ) : (
          <table className="chq-participants-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Visible</th>
                <th>Invite status</th>
              </tr>
            </thead>
            <tbody>
              {detail.participants.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.email}</td>
                  <td>{p.role}</td>
                  <td>{p.visible ? 'Yes' : 'No'}</td>
                  <td>{p.inviteStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Answers</h2>
        {answerRows.length === 0 ? (
          <p>No custom answers.</p>
        ) : (
          <dl className="chq-answers-list">
            {answerRows.map((row) => (
              <div key={row.fieldId} className="chq-answer-row">
                <dt>{row.label}</dt>
                <dd>{row.displayValue}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section>
        <h2>Meta</h2>
        <p>Created: {formatDate(detail.createdAt)}</p>
        <p>Updated: {formatDate(detail.updatedAt)}</p>
        <p>Accepted: {formatDate(detail.acceptedAt)}</p>
      </section>
    </div>
  );
}
