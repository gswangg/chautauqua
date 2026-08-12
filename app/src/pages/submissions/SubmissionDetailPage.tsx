// Admin submission detail page (DEC-045). SPA-only: consumes existing
// GET /api/v1/submissions/:id, the DEC-016 forms + tracks endpoints, and
// the existing bulk status endpoint (ids:[id]) — no new server code.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { formatDate as formatTimestamp, formatDateTime } from '../../lib/dates';
import type { CfpForm } from '../forms/types';
import { buildAnswerRows, resolveAnswerFields } from './detailRows';
import './detail.css';
import {
  STATUS_LABELS,
  type ContactSearchResult,
  type InviteStatus,
  type SubmissionDetail,
  type SubmissionDetailParticipant,
  type SubmissionEvaluation,
  type SubmissionStatus,
  type Track,
} from './types';

// DEC-577: the decision panel's status <select> becomes a segmented button
// group -- markup surgery scoped to this page. Only the three states an
// organiser actually DECIDES between are buttons; the pipeline's own
// accept_queue/decline_queue intermediate states are set elsewhere (bulk
// worklist), never from this per-submission decision panel.
const DECISION_STATUSES: readonly SubmissionStatus[] = ['pending', 'accepted', 'declined'];

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
  const [evaluations, setEvaluations] = useState<SubmissionEvaluation[]>([]);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  const [editingTracks, setEditingTracks] = useState(false);
  const [trackSelection, setTrackSelection] = useState<string[]>([]);
  const [savingTracks, setSavingTracks] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<SubmissionDetail>(`/submissions/${id}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submission'))
      .finally(() => setLoading(false));
  }, [id]);

  // DEC-596: the organiser reads the same evaluation the reviewer wrote.
  useEffect(() => {
    if (!id) return;
    setEvaluationsError(null);
    apiList<SubmissionEvaluation>(`/submissions/${id}/evaluations`)
      .then((res) => setEvaluations(res.items))
      .catch((err) => setEvaluationsError(err instanceof ApiError ? err.message : 'Failed to load reviews'));
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

  function startEditingTracks() {
    if (!detail) return;
    setTracksError(null);
    setTrackSelection(detail.trackIds);
    setEditingTracks(true);
  }

  function toggleTrackSelection(trackId: string) {
    setTrackSelection((prev) => (prev.includes(trackId) ? prev.filter((t) => t !== trackId) : [...prev, trackId]));
  }

  // DEC-638/DEC-598: trackIds is a full-set replace -- an empty array is a
  // legal clear, never a validation error. On failure, roll back loudly by
  // refetching the detail rather than restoring a stale in-memory snapshot.
  async function saveTracks() {
    if (!detail || !id) return;
    const nextIds = trackSelection;
    const previous = detail;
    setSavingTracks(true);
    setTracksError(null);
    // Optimistic update.
    setDetail({ ...detail, trackIds: nextIds });
    try {
      const updated = await apiPatch<SubmissionDetail>(`/submissions/${id}`, { trackIds: nextIds });
      setDetail(updated);
      setEditingTracks(false);
    } catch (err) {
      // Loud rollback: refetch the server's actual set rather than trusting
      // the pre-write snapshot, which may itself be stale.
      setDetail(previous);
      setTracksError(err instanceof ApiError ? err.message : 'Track update failed');
      try {
        const refetched = await apiGet<SubmissionDetail>(`/submissions/${id}`);
        setDetail(refetched);
        setTrackSelection(refetched.trackIds);
      } catch {
        // Keep the pre-write snapshot if the refetch itself fails; the
        // error banner above already communicates the failure.
      }
    } finally {
      setSavingTracks(false);
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
  // Speaker card: the named 'speaker' role participant, falling back to the
  // first (order asc) participant when no role is literally 'speaker'.
  const speaker = detail.participants.find((p) => p.role === 'speaker') ?? detail.participants[0] ?? null;

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
                  <button type="button" className="chq-btn chq-btn-tertiary" onClick={startEditing}>
                    Edit
                  </button>
                </>
              ) : (
                <div className="chq-detail-edit-form">
                  <label>
                    Title
                    <input
                      type="text"
                      className="chq-input"
                      value={editTitle}
                      disabled={savingEdit}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    Abstract
                    <textarea
                      className="chq-textarea"
                      value={editDescription}
                      disabled={savingEdit}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </label>
                  <div className="chq-detail-edit-form-actions">
                    <button type="button" className="chq-btn chq-btn-primary" disabled={savingEdit} onClick={saveEdit}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="chq-btn chq-btn-secondary"
                      disabled={savingEdit}
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
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
                          className="chq-btn chq-btn-tertiary"
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
              {tracksError && <div className="chq-error-banner">{tracksError}</div>}
              {!editingTracks ? (
                <>
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
                  <button type="button" className="chq-btn chq-btn-tertiary" onClick={startEditingTracks}>
                    Edit tracks
                  </button>
                </>
              ) : (
                <div className="chq-detail-track-editor">
                  {tracks.length === 0 ? (
                    <p>No tracks configured for this event.</p>
                  ) : (
                    <ul className="chq-detail-track-options">
                      {tracks.map((track) => (
                        <li key={track.id}>
                          <label className="chq-detail-track-option">
                            <input
                              type="checkbox"
                              className="chq-check"
                              checked={trackSelection.includes(track.id)}
                              disabled={savingTracks}
                              onChange={() => toggleTrackSelection(track.id)}
                            />
                            {track.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="chq-detail-edit-form-actions">
                    <button type="button" className="chq-btn chq-btn-primary" disabled={savingTracks} onClick={saveTracks}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="chq-btn chq-btn-secondary"
                      disabled={savingTracks}
                      onClick={() => setEditingTracks(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
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
                              className="chq-check"
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

              <div className="chq-add-co-presenter chq-detail-copresenter-search">
                <label>
                  Add co-presenter
                  <input
                    type="search"
                    className="chq-input"
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
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  disabled={coPresenterSearching}
                  onClick={searchCoPresenters}
                >
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
                          className="chq-btn chq-btn-primary"
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

          <section className="chq-detail-section chq-detail-reviews">
            <h2 className="chq-detail-section-title">Reviews</h2>
            <div className="chq-detail-section-body">
              {evaluationsError && <div className="chq-error-banner">{evaluationsError}</div>}
              {evaluations.length === 0 ? (
                <p>No reviews recorded yet.</p>
              ) : (
                <ul className="chq-review-list">
                  {evaluations.map((ev, i) => (
                    <li key={`${ev.planId}-${ev.round}-${i}`} className="chq-review-entry">
                      <div className="chq-review-entry-meta">
                        <strong>{ev.reviewerName ?? 'Anonymous reviewer'}</strong>
                        <span className="chq-review-entry-plan">
                          {ev.planName} &middot; Round {ev.round}
                        </span>
                      </div>
                      {Object.keys(ev.scores).length > 0 && (
                        <dl className="chq-review-scores">
                          {Object.entries(ev.scores).map(([criterionId, value]) => (
                            <div key={criterionId} className="chq-review-score">
                              <dt>{criterionId}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {/* Copy rule 6: sentences are for people -- the full
                          comment text, never truncated. */}
                      {ev.comment && <p className="chq-review-comment">{ev.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="chq-detail-section">
            <h2 className="chq-detail-section-title">Meta</h2>
            <div className="chq-detail-section-body">
              <p>Created: {formatDateTime(detail.createdAt)}</p>
              <p>Updated: {formatDateTime(detail.updatedAt)}</p>
              <p>Accepted: {formatDateTime(detail.acceptedAt)}</p>
            </div>
          </section>
        </div>

        <aside className="chq-detail-aside">
          {speaker && (
            <section className="chq-detail-section chq-detail-speaker">
              <h2 className="chq-detail-section-title">Speaker</h2>
              <div className="chq-detail-section-body chq-detail-speaker-body">
                <strong className="chq-detail-speaker-name">{speaker.name}</strong>
                {(speaker.title || speaker.company) && (
                  <span className="chq-detail-speaker-role">
                    {[speaker.title, speaker.company].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="chq-detail-speaker-email">{speaker.email}</span>
              </div>
            </section>
          )}

          <section className="chq-detail-section chq-detail-decision">
            <h2 className="chq-detail-section-title">Decision</h2>
            <div className="chq-detail-section-body chq-detail-decision-body">
              <div className="chq-detail-decision-status">
                Status
                <div className="chq-segmented" role="group" aria-label="Status">
                  {DECISION_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={detail.status === status ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
                      disabled={statusPending}
                      aria-pressed={detail.status === status}
                      onClick={() => changeStatus(status)}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
              <span className="chq-content-status">Content: {detail.contentStatus}</span>
              <div className="chq-detail-decision-actions">
                <button
                  type="button"
                  className="chq-btn chq-btn-primary"
                  disabled={contentStatusPending || detail.contentStatus === 'approved'}
                  onClick={() => changeContentStatus('approved')}
                >
                  Approve content
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  disabled={contentStatusPending || detail.contentStatus === 'changes_requested'}
                  onClick={() => changeContentStatus('changes_requested')}
                >
                  Request changes
                </button>
                <button type="button" className="chq-btn chq-btn-secondary" disabled={cloning} onClick={cloneSubmission}>
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
