// Admin submission detail page (DEC-045). SPA-only: consumes existing
// GET /api/v1/submissions/:id, the DEC-016 forms + tracks endpoints, and
// the existing bulk status endpoint (ids:[id]) — no new server code.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import type { CfpForm } from '../forms/types';
import { buildAnswerRows, resolveAnswerFields } from './detailRows';
import {
  STATUS_LABELS,
  SUBMISSION_STATUSES,
  type ContactSearchResult,
  type InviteStatus,
  type SubmissionDetail,
  type SubmissionDetailParticipant,
  type SubmissionStatus,
  type Track,
} from './types';

function formatDate(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleString();
}

const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  none: 'None',
  invited: 'Invited',
  accepted: 'Accepted',
  declined: 'Declined',
};

function InviteStatusChip({ status }: { status: InviteStatus }) {
  return <span className={`chq-status-pill chq-invite-status-${status}`}>{INVITE_STATUS_LABELS[status]}</span>;
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
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [visiblePending, setVisiblePending] = useState<string | null>(null);
  const [coPresenterQuery, setCoPresenterQuery] = useState('');
  const [coPresenterResults, setCoPresenterResults] = useState<ContactSearchResult[]>([]);
  const [coPresenterSearching, setCoPresenterSearching] = useState(false);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);

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

  async function toggleParticipantVisible(participant: SubmissionDetailParticipant) {
    if (!detail || !id) return;
    const nextVisible = !participant.visible;
    const previous = detail;
    setParticipantsError(null);
    setVisiblePending(participant.id);
    // Optimistic update.
    setDetail({
      ...detail,
      participants: detail.participants.map((p) => (p.id === participant.id ? { ...p, visible: nextVisible } : p)),
    });
    try {
      await apiPatch<SubmissionDetailParticipant>(`/submissions/${id}/participants/${participant.id}`, {
        visible: nextVisible,
      });
    } catch (err) {
      // Loud rollback: restore prior state and surface the failure.
      setDetail(previous);
      setParticipantsError(err instanceof ApiError ? `Visibility update failed: ${err.message}` : 'Visibility update failed');
    } finally {
      setVisiblePending(null);
    }
  }

  async function searchCoPresenters() {
    const q = coPresenterQuery.trim();
    if (!q) {
      setCoPresenterResults([]);
      return;
    }
    setCoPresenterSearching(true);
    setParticipantsError(null);
    try {
      const res = await apiList<ContactSearchResult>(`/contacts?q=${encodeURIComponent(q)}`);
      setCoPresenterResults(res.items);
    } catch (err) {
      setParticipantsError(err instanceof ApiError ? err.message : 'Contact search failed');
    } finally {
      setCoPresenterSearching(false);
    }
  }

  async function addCoPresenter(contact: ContactSearchResult) {
    if (!id) return;
    setAddingContactId(contact.id);
    setParticipantsError(null);
    try {
      const created = await apiPost<SubmissionDetailParticipant>(`/submissions/${id}/participants`, {
        contactId: contact.id,
      });
      setDetail((prev) => (prev ? { ...prev, participants: [...prev.participants, created] } : prev));
      setCoPresenterResults([]);
      setCoPresenterQuery('');
    } catch (err) {
      // Surface the DEC-070 duplicate-contact 'invalid' error inline.
      setParticipantsError(err instanceof ApiError ? err.message : 'Failed to add co-presenter');
    } finally {
      setAddingContactId(null);
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
        {participantsError && <div className="chq-error-banner">{participantsError}</div>}
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
                  <td>
                    <label className="chq-visible-toggle">
                      <input
                        type="checkbox"
                        checked={p.visible}
                        disabled={visiblePending === p.id}
                        onChange={() => toggleParticipantVisible(p)}
                        aria-label={`Visible: ${p.name}`}
                      />
                    </label>
                  </td>
                  <td>
                    <InviteStatusChip status={p.inviteStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="chq-add-co-presenter">
          <label>
            Add co-presenter
            <input
              type="search"
              aria-label="Search contacts"
              placeholder="Search contacts by name or email..."
              value={coPresenterQuery}
              onChange={(e) => setCoPresenterQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  searchCoPresenters();
                }
              }}
            />
          </label>
          <button type="button" disabled={coPresenterSearching} onClick={searchCoPresenters}>
            Search
          </button>
          {coPresenterResults.length > 0 && (
            <ul className="chq-co-presenter-results">
              {coPresenterResults.map((contact) => (
                <li key={contact.id}>
                  <span>
                    {contact.firstName} {contact.lastName} ({contact.email})
                  </span>
                  <button type="button" disabled={addingContactId === contact.id} onClick={() => addCoPresenter(contact)}>
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
