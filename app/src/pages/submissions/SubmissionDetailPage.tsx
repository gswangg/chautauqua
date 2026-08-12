// Admin submission detail page (DEC-045). SPA-only: consumes existing
// GET /api/v1/submissions/:id, the DEC-016 forms + tracks endpoints, and
// the existing bulk status endpoint (ids:[id]) — no new server code.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { formatDate as formatTimestamp } from '../../lib/dates';
import type { CfpForm } from '../forms/types';
import { buildAnswerRows, resolveAnswerFields } from './detailRows';
import './detail.css';
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

// CNT-11 (DEC-158): session content version history.
interface RevisionEntry {
  id: string;
  editorName: string;
  title: string;
  description: string | null;
  createdAt: number;
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
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [contentStatusPending, setContentStatusPending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<RevisionEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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

  function startEditing() {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditDescription(detail.description ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!detail || !id) return;
    const title = editTitle.trim();
    if (!title) {
      setError('Title is required');
      return;
    }
    const previous = detail;
    setSavingEdit(true);
    setError(null);
    // Optimistic update.
    setDetail({ ...detail, title, description: editDescription });
    try {
      const updated = await apiPatch<SubmissionDetail>(`/submissions/${id}`, {
        title,
        description: editDescription,
      });
      setDetail(updated);
      setEditing(false);
    } catch (err) {
      // Loud rollback: restore prior state and surface the failure.
      setDetail(previous);
      setError(err instanceof ApiError ? `Edit failed: ${err.message}` : 'Edit failed');
    } finally {
      setSavingEdit(false);
    }
  }

  async function changeContentStatus(status: SubmissionDetail['contentStatus']) {
    if (!detail || !id) return;
    const previous = detail;
    setContentStatusPending(true);
    setError(null);
    // Optimistic update.
    setDetail({ ...detail, contentStatus: status });
    try {
      await apiPost<{ id: string; contentStatus: string }>(`/submissions/${id}/content-status`, {
        contentStatus: status,
      });
    } catch (err) {
      // Loud rollback: restore prior state and surface the failure.
      setDetail(previous);
      setError(err instanceof ApiError ? `Content status update failed: ${err.message}` : 'Content status update failed');
    } finally {
      setContentStatusPending(false);
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

  async function toggleHistory() {
    const opening = !historyOpen;
    setHistoryOpen(opening);
    if (opening && id) {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await apiList<RevisionEntry>(`/submissions/${id}/revisions`);
        setHistoryEntries(res.items);
      } catch (err) {
        setHistoryError(err instanceof ApiError ? err.message : 'Failed to load history');
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  async function restoreRevision(revisionId: string) {
    if (!id) return;
    setRestoringId(revisionId);
    setHistoryError(null);
    try {
      const updated = await apiPost<SubmissionDetail>(`/submissions/${id}/revisions/${revisionId}/restore`);
      setDetail(updated);
      const res = await apiList<RevisionEntry>(`/submissions/${id}/revisions`);
      setHistoryEntries(res.items);
    } catch (err) {
      setHistoryError(err instanceof ApiError ? `Restore failed: ${err.message}` : 'Restore failed');
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) {
    return (
      <div className="chq-page chq-detail-page">
        <Link to="/submissions" className="chq-detail-back">
          &larr; All submissions
        </Link>
        <p>Loading...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="chq-page chq-detail-page">
        <Link to="/submissions" className="chq-detail-back">
          &larr; All submissions
        </Link>
        {error && <div className="chq-error-banner">{error}</div>}
        {!error && <p>Submission not found.</p>}
      </div>
    );
  }

  const trackNames = detail.trackIds.map((trackId) => tracks.find((t) => t.id === trackId)?.name ?? trackId);
  const answerRows = buildAnswerRows(detail.answers, resolveAnswerFields(form, detail.formId));

  return (
    <div className="chq-page chq-detail-page">
      <div className="chq-detail-topbar">
        <Link to="/submissions" className="chq-detail-back">
          &larr; All submissions
        </Link>
      </div>

      {error && <div className="chq-error-banner">{error}</div>}

      <header className="chq-detail-heading">
        <h1>
          {detail.ref}: {detail.title}
        </h1>
      </header>

      <div className="chq-detail-layout">
        <div className="chq-detail-main">
          <section className="chq-detail-section">
            <h2 className="chq-detail-section-title">Session details</h2>
            <div className="chq-detail-section-body">
              {!editing ? (
                <>
                  {detail.description && <p className="chq-detail-abstract">{detail.description}</p>}
                  <button type="button" onClick={startEditing}>
                    Edit
                  </button>
                </>
              ) : (
                <div className="chq-submission-edit-form">
                  <label>
                    Title
                    <input
                      type="text"
                      value={editTitle}
                      disabled={savingEdit}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    Abstract
                    <textarea
                      value={editDescription}
                      disabled={savingEdit}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </label>
                  <button type="button" disabled={savingEdit} onClick={saveEdit}>
                    Save
                  </button>
                  <button type="button" disabled={savingEdit} onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="chq-detail-section chq-submission-history">
            <h2 className="chq-detail-section-title">
              <button type="button" className="chq-detail-history-toggle" onClick={toggleHistory}>
                {historyOpen ? 'Hide history' : 'Show history'}
              </button>
            </h2>
            {historyOpen && (
              <div className="chq-detail-section-body">
                {historyError && <div className="chq-error-banner">{historyError}</div>}
                {historyLoading ? (
                  <p>Loading history...</p>
                ) : historyEntries.length === 0 ? (
                  <p>No edits recorded yet.</p>
                ) : (
                  <ul className="chq-submission-history-list">
                    {historyEntries.map((entry) => (
                      <li key={entry.id} className="chq-submission-history-entry">
                        <div>
                          <strong>{entry.editorName}</strong> &mdash; {formatTimestamp(entry.createdAt)}
                        </div>
                        <div>{entry.title}</div>
                        <button
                          type="button"
                          disabled={restoringId === entry.id}
                          onClick={() => restoreRevision(entry.id)}
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="chq-detail-section">
            <h2 className="chq-detail-section-title">Tracks</h2>
            <div className="chq-detail-section-body">
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
            </div>
          </section>

          <section className="chq-detail-section">
            <h2 className="chq-detail-section-title">Participants</h2>
            <div className="chq-detail-section-body">
              {participantsError && <div className="chq-error-banner">{participantsError}</div>}
              {detail.participants.length === 0 ? (
                <p>No participants.</p>
              ) : (
                <table className="chq-table chq-participants-table">
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
                        <button
                          type="button"
                          disabled={addingContactId === contact.id}
                          onClick={() => addCoPresenter(contact)}
                        >
                          Add
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="chq-detail-section">
            <h2 className="chq-detail-section-title">Answers</h2>
            <div className="chq-detail-section-body">
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
            </div>
          </section>

          <section className="chq-detail-section">
            <h2 className="chq-detail-section-title">Meta</h2>
            <div className="chq-detail-section-body">
              <p>Created: {formatDate(detail.createdAt)}</p>
              <p>Updated: {formatDate(detail.updatedAt)}</p>
              <p>Accepted: {formatDate(detail.acceptedAt)}</p>
            </div>
          </section>
        </div>

        <aside className="chq-detail-aside">
          <section className="chq-detail-section chq-detail-decision">
            <h2 className="chq-detail-section-title">Decision</h2>
            <div className="chq-detail-section-body chq-detail-decision-body">
              <label className="chq-detail-decision-status">
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
              <div className="chq-detail-decision-actions">
                <button
                  type="button"
                  disabled={contentStatusPending || detail.contentStatus === 'approved'}
                  onClick={() => changeContentStatus('approved')}
                >
                  Approve content
                </button>
                <button
                  type="button"
                  disabled={contentStatusPending || detail.contentStatus === 'changes_requested'}
                  onClick={() => changeContentStatus('changes_requested')}
                >
                  Request changes
                </button>
                <button type="button" disabled={cloning} onClick={cloneSubmission}>
                  Clone
                </button>
              </div>
              <p className="chq-detail-decision-note">Deciding never sends email. Notify the speaker from Comms.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
