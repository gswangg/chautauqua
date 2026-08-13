// Admin submission detail page (DEC-045). SPA-only: consumes existing
// GET /api/v1/submissions/:id, the DEC-016 forms + tracks endpoints, and
// the existing bulk status endpoint (ids:[id]) — no new server code.
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { formatDate as formatTimestamp, formatDateTime } from '../../lib/dates';
import { formatEventDate } from '../../../../src/lib/event-time';
import { SESSION_FORMAT_FIELD_ID } from '../../../../src/forms/types';
import { parseFormatDurationMin } from '../../../../src/domain/schedule';
import type { CfpForm } from '../forms/types';
import { buildAnswerRows, resolveAnswerFields } from './detailRows';
import { formatSubmissionScheduleLine } from './schedule';
import { DelayedLoading } from '../../components/DelayedLoading';
import { buildSubmissionsQuery, parseSubmissionsQuery } from './filters';
import { countOf } from '../../lib/plural';
import './detail.css';
import {
  STATUS_LABELS,
  type ContactSearchResult,
  type InviteStatus,
  type SubmissionDetail,
  type SubmissionDetailParticipant,
  type SubmissionListItem,
  type SubmissionStatus,
  type Track,
} from './types';
// DEC-761: code that depends on a decision must reference its constant.
import { DEC_733, DEC_761, DEC_784, DEC_998 } from '../../../../src/decisions';
// DEC-784/DEC-604: role is picked from the SAME imported vocabulary
// AddToEventModal.tsx uses -- never a hand-written list -- and rendered
// through participantRoleLabel, never the raw stored value.
import { PARTICIPANT_ROLE_OPTIONS, participantRoleLabel } from '../../../../src/domain/participant-roles';

void DEC_733;
void DEC_761;
void DEC_784;
void DEC_998;

// DEC-878: the decision panel is a RAIL, not a segmented button group --
// markup surgery scoped to this page (docs/design 'Chautauqua
// Submissions.dc.html' lines 265-273). Only the three states an organiser
// actually DECIDES between are ever offered as buttons; the pipeline's own
// accept_queue/decline_queue intermediate states are set elsewhere (bulk
// worklist), never from this per-submission decision panel. 'pending' is
// the rail's starting point, not a choosable status -- the only way back to
// it from a decided state is the single quiet 'Back to pending' link.
const DECIDABLE_STATUSES = ['accepted', 'declined', 'waitlisted'] as const;
type DecidableStatus = (typeof DECIDABLE_STATUSES)[number];

function isDecidableStatus(status: SubmissionStatus): status is DecidableStatus {
  return (DECIDABLE_STATUSES as readonly SubmissionStatus[]).includes(status);
}

// Imperative verb form for the rail's Accept/Decline/Waitlist buttons --
// distinct from STATUS_LABELS' noun form ('Accepted'/'Declined'/
// 'Waitlisted') used for the stated-decision line once one is in force.
const DECISION_ACTION_LABELS: Record<DecidableStatus, string> = {
  accepted: 'Accept',
  declined: 'Decline',
  waitlisted: 'Waitlist',
};

const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  none: 'None',
  invited: 'Invited',
  accepted: 'Accepted',
  declined: 'Declined',
};

function InviteStatusChip({ status }: { status: InviteStatus }) {
  // DEC-367: no per-status colour ("no red and no third accent") -- the
  // pill's single neutral .chq-status-pill face is the whole of its style;
  // a per-value chq-invite-status-<status> modifier was dead weight (no
  // rule ever existed, and DEC-367 forbids adding one), so it is dropped
  // rather than given a rule (DEC-976).
  return <span className="chq-status-pill">{INVITE_STATUS_LABELS[status]}</span>;
}

// CNT-11 (DEC-158): session content version history.
interface RevisionEntry {
  id: string;
  editorName: string;
  title: string;
  description: string | null;
  createdAt: number;
}

// DEC-723: /submissions/:id/evaluations item, landed server-side by task
// w2-a in this same batch. criteria[] carries the plan's rubric (label,
// kind, weight) so a criterion's DISPLAY VALUE is always looked up by
// criteria[].label -- the raw criterionId key never reaches the DOM. score
// is the plan's weighted total (2dp when present). DEC-736: the organiser
// is always told who reviewed, even on an anonymized plan, so reviewerName
// is never null here and 'Anonymous reviewer' must never render.
interface ReviewCriterion {
  id: string;
  label: string;
  kind: string;
  weight: number;
}

interface SubmissionReviewItem {
  planId: string;
  planName: string;
  round: number;
  reviewerName: string;
  scores: Record<string, number | string>;
  criteria: ReviewCriterion[];
  score: number | null;
  comment: string | null;
  submittedAt: number | null;
}

// Whole calendar days between createdAt and now, both read in the event's
// own IANA timezone (never the viewer's ambient zone) -- DEC-408's
// zone-explicit contract via formatEventDate, which throws on an
// empty/invalid timeZone. Returns null (never throws) when the zone isn't
// known yet or is invalid, so the caller can render the label's bare form
// rather than a dangling '· ' or a crashed page.
function calendarDayIndex(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

// DEC-908 (wave 42 amendment): the eyebrow's session-format grammar reads
// 'Talk, 30m' -- a comma and a bare 'Nm' suffix -- never the raw CFP option
// label's '(N min)' parenthetical. Reuses parseFormatDurationMin (the same
// minute-extraction rule the scheduler already trusts) rather than a second
// regex, so the two readings of one label cannot drift apart; a label the
// parser can't read (no parenthesised duration) renders unchanged rather
// than inventing a length.
function formatSessionFormatGrammar(rawLabel: string): string {
  const minutes = parseFormatDurationMin(rawLabel);
  if (minutes === null) return rawLabel;
  const name = rawLabel.replace(/\s*\(\d+\s*(?:min|mins|minutes)\)\s*$/i, '').trim();
  return `${name}, ${minutes}m`;
}

function daysAwaitingTriage(createdAt: number, timeZone: string | null, now: number): number | null {
  if (!timeZone) return null;
  try {
    // Reuses formatEventDate's empty/invalid-timeZone validation (DEC-408)
    // before doing the raw day-boundary arithmetic Intl doesn't expose as
    // a single call.
    formatEventDate(now, timeZone);
    const diff = calendarDayIndex(now, timeZone) - calendarDayIndex(createdAt, timeZone);
    return diff >= 0 ? diff : null;
  } catch {
    return null;
  }
}

// DEC-878: the stated decision line's date, formatted through the SAME
// zone-explicit helper the triage label already uses (never the viewer's
// ambient zone) -- null (never throws) when the zone isn't known yet, in
// which case the caller renders the decision noun alone.
function decidedDateLabel(decidedAt: number, timeZone: string | null): string | null {
  if (!timeZone) return null;
  try {
    return formatEventDate(decidedAt, timeZone);
  } catch {
    return null;
  }
}

// DEC-761: position within the list the organiser came from, re-derived
// from the SAME list query the table itself uses -- never handed down
// through router state, so a reload or a shared link renders identically.
// prevId/nextId are only known within the fetched page: absent (not
// disabled, DEC-733) past either edge of that page.
interface ListPosition {
  total: number;
  position: number;
  prevId: string | null;
  nextId: string | null;
}

// DEC-892: the history panel's real timeline — submitted/edited/reviewed/
// emailed, merged server-side by listSubmissionHistory.
interface HistoryTimelineEntry {
  id: string;
  at: number;
  kind: 'submitted' | 'edited' | 'reviewed' | 'emailed';
  label: string;
  detail: string | null;
}

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  // DEC-998: the editor and the history disclosure are URL state (`?edit=1`
  // / `?history=1`), not local-only useState -- a deliverable-detail link
  // can open either directly, and either can be bookmarked/shared. Precedent:
  // DEC-710/DEC-728 (settings drills, comms tabs) use the same
  // searchParams-as-source-of-truth shape.
  const [searchParams, setSearchParams] = useSearchParams();

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [form, setForm] = useState<CfpForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [visiblePending, setVisiblePending] = useState<string | null>(null);
  const [coPresenterQuery, setCoPresenterQuery] = useState('');
  // DEC-784: role is picked HERE, at add time -- never defaulted silently
  // server-side -- from the same imported vocabulary as every other picker.
  const [coPresenterRole, setCoPresenterRole] = useState(PARTICIPANT_ROLE_OPTIONS[0]!.value);
  const [coPresenterResults, setCoPresenterResults] = useState<ContactSearchResult[]>([]);
  const [coPresenterSearching, setCoPresenterSearching] = useState(false);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);
  // DEC-998: editing/historyOpen are derived from the URL, not their own
  // useState -- setSearchParams is the single writer for both.
  const editing = searchParams.get('edit') === '1';
  // DEC-908 (wave 42 amendment): History renders EXPANDED by default (the
  // frame lists entries inline) -- absent is open, `?history=0` is the one
  // way to reach the collapsed state, so a bookmarked/shared link still
  // round-trips through the toggle.
  const historyOpen = searchParams.get('history') !== '0';
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryTimelineEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<SubmissionReviewItem[]>([]);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  const [editingTracks, setEditingTracks] = useState(false);
  const [trackSelection, setTrackSelection] = useState<string[]>([]);
  const [savingTracks, setSavingTracks] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);
  // DEC-743: the triage micro-label needs the OWNING EVENT's timezone
  // (never the viewer's ambient zone) to compute a calendar-day count --
  // null while unresolved, in which case the label renders without its
  // '· N days' clause.
  const [eventTimeZone, setEventTimeZone] = useState<string | null>(null);
  const [listPosition, setListPosition] = useState<ListPosition | null>(null);
  const [formatPending, setFormatPending] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

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
    apiList<SubmissionReviewItem>(`/submissions/${id}/evaluations`)
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
    // DEC-743: the triage label degrades to its bare form (no dangling
    // '· ') rather than surfacing a page-level error when the event's
    // timezone can't be resolved, so failures here are swallowed
    // deliberately (never fed into the page's error banner).
    apiGet<{ timezone: string }>(`/events/${detail.eventId}`)
      .then((res) => setEventTimeZone(res.timezone))
      .catch(() => setEventTimeZone(null));
    // Deliberately keyed on detail.eventId only: re-runs when a clone
    // navigates to a new submission in a different (or the same) event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.eventId]);

  // DEC-998: a direct `?edit=1` link (e.g. from the deliverable detail's
  // 'Edit title and abstract' action) opens the editor prefilled exactly as
  // startEditing does today, once detail has loaded -- the button click path
  // still prefills synchronously via startEditing itself, so this effect is
  // a no-op there (same values).
  useEffect(() => {
    if (!detail) return;
    if (searchParams.get('edit') === '1') {
      setEditTitle(detail.title);
      setEditDescription(detail.description ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  // DEC-998: a direct `?history=1` link opens AND loads the history
  // timeline -- the same effect fires when the Show/Hide toggle flips the
  // param, so loadHistory has exactly one call site for "opening" either way.
  useEffect(() => {
    if (!id || !historyOpen) return;
    setHistoryLoading(true);
    setHistoryError(null);
    loadHistory()
      .catch((err) => setHistoryError(err instanceof ApiError ? err.message : 'Failed to load history'))
      .finally(() => setHistoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, historyOpen]);

  // DEC-761: re-run the table's OWN list query from this page's own
  // search params (not router state) to derive total/position/neighbours.
  // A bare /submissions/:id (no params) falls back to the unfiltered
  // default list, which is still a truthful position.
  useEffect(() => {
    if (!detail || !id) return;
    const listFilters = parseSubmissionsQuery(location.search);
    apiList<SubmissionListItem>(`/events/${detail.eventId}/submissions${buildSubmissionsQuery(listFilters)}`)
      .then((res) => {
        const idx = res.items.findIndex((item) => item.id === id);
        if (idx === -1) {
          // Stale link: the id isn't on the returned page. Render with no
          // position controls rather than erroring.
          setListPosition(null);
          return;
        }
        setListPosition({
          total: res.total,
          position: (res.page - 1) * res.perPage + idx + 1,
          prevId: idx > 0 ? res.items[idx - 1]!.id : null,
          nextId: idx < res.items.length - 1 ? res.items[idx + 1]!.id : null,
        });
      })
      .catch(() => setListPosition(null));
  }, [detail?.eventId, id, location.search]);

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
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('edit', '1');
      return params;
    });
  }

  function closeEditing() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('edit');
      return params;
    });
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
      closeEditing();
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

  // DEC-780/DEC-755: the format select PATCHes { format } straight through
  // the route that already validates it against the event default form's
  // SESSION_FORMAT field options (src/routes/api/submissions.ts) -- no new
  // validation, no second writer.
  async function changeFormat(value: string) {
    if (!detail || !id || !value) return;
    const previous = detail;
    setFormatPending(true);
    setFormatError(null);
    setDetail({ ...detail, answers: { ...detail.answers, [SESSION_FORMAT_FIELD_ID]: value } });
    try {
      const updated = await apiPatch<SubmissionDetail>(`/submissions/${id}`, { format: value });
      setDetail(updated);
    } catch (err) {
      setDetail(previous);
      setFormatError(err instanceof ApiError ? `Format update failed: ${err.message}` : 'Format update failed');
    } finally {
      setFormatPending(false);
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
        role: coPresenterRole,
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

  async function loadHistory() {
    if (!id) return;
    const res = await apiList<HistoryTimelineEntry>(`/submissions/${id}/history`);
    setHistoryEntries(res.items);
  }

  function toggleHistory() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (historyOpen) {
        params.set('history', '0');
      } else {
        params.delete('history');
      }
      return params;
    });
  }

  // A revision is restorable by its own id — the timeline's 'edited' entries
  // are sourced 1:1 from submission_revision rows (history.ts reuses
  // listRevisions), so entry.id IS the revisionId here.
  async function restoreRevision(revisionId: string) {
    if (!id) return;
    setRestoringId(revisionId);
    setHistoryError(null);
    try {
      const updated = await apiPost<SubmissionDetail>(`/submissions/${id}/revisions/${revisionId}/restore`);
      setDetail(updated);
      await loadHistory();
    } catch (err) {
      setHistoryError(err instanceof ApiError ? `Restore failed: ${err.message}` : 'Restore failed');
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) {
    return (
      <div className="chq-page chq-detail-page chq-measure-wide">
        <Link to="/submissions" className="chq-detail-back">
          &larr; All submissions
        </Link>
        <DelayedLoading />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="chq-page chq-detail-page chq-measure-wide">
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
  // DEC-908 eyebrow: track names joined ' · ' plus the session format,
  // either half omitted when absent, the whole line omitted when both are.
  const eyebrowTrackNames = trackNames.join(' · ');
  const eyebrowFormat = typeof detail.answers[SESSION_FORMAT_FIELD_ID] === 'string'
    ? formatSessionFormatGrammar((detail.answers[SESSION_FORMAT_FIELD_ID] as string).trim())
    : '';
  const eyebrowParts = [eyebrowTrackNames, eyebrowFormat].filter((part) => part !== '');
  const eyebrowText = eyebrowParts.length > 0 ? eyebrowParts.join(' · ') : null;
  // Speaker card: the named 'speaker' role participant, falling back to the
  // first (order asc) participant when no role is literally 'speaker'.
  const speaker = detail.participants.find((p) => p.role === 'speaker') ?? detail.participants[0] ?? null;
  const triageDays = daysAwaitingTriage(detail.createdAt, eventTimeZone, Date.now());
  // DEC-878: the rail's two states -- decided (accepted/declined/
  // waitlisted) shows the stated-decision line + Back to pending; anything
  // else (pending, plus the bulk worklist's own accept_queue/decline_queue
  // intermediate states, which this per-submission panel never sets) shows
  // the pending rail (Accept primary, Decline|Waitlist secondary pair).
  const decidedStatus = isDecidableStatus(detail.status) ? detail.status : null;
  // updatedAt is bumped on every status write (src/server/repo/submissions/
  // status.ts), including the non-firing branch, so it is the one existing
  // timestamp that is truthful for every decided status -- acceptedAt only
  // ever fires for the FIRST accept transition.
  const decidedLabel = decidedStatus ? decidedDateLabel(detail.updatedAt, eventTimeZone) : null;
  // DEC-780: the event default form's own SESSION_FORMAT field, matched by
  // its stable id (not a label heuristic) -- the same field the PATCH route
  // validates format against.
  const formatField = form?.fields.find((f) => f.id === SESSION_FORMAT_FIELD_ID);
  const currentFormat = typeof detail.answers[SESSION_FORMAT_FIELD_ID] === 'string'
    ? (detail.answers[SESSION_FORMAT_FIELD_ID] as string)
    : '';

  return (
    <div className="chq-page chq-detail-page chq-measure-wide">
      {/* DEC-908 ref row: back link, then the muted '<ref> · N of M' string
          (absent -- not blank -- when this page's own list query hasn't
          resolved a position, e.g. a stale/shared link), then the
          right-aligned Previous/Next TEXT links. DEC-733: at either edge
          the corresponding link is absent, never disabled; both keep
          location.search so paging survives the round trip. */}
      <div className="chq-detail-ref-row">
        <Link to="/submissions" className="chq-detail-back">
          &larr; All submissions
        </Link>
        {listPosition && (
          <span className="chq-detail-ref-position">
            {detail.ref} &middot; {listPosition.position} of {listPosition.total}
          </span>
        )}
        {listPosition && (listPosition.prevId || listPosition.nextId) && (
          <div className="chq-detail-position" aria-label="Position in list">
            {listPosition.prevId && (
              <Link
                to={`/submissions/${listPosition.prevId}${location.search}`}
                className="chq-detail-position-prev"
                aria-label="Previous submission"
              >
                &lsaquo; Previous
              </Link>
            )}
            {listPosition.nextId && (
              <Link
                to={`/submissions/${listPosition.nextId}${location.search}`}
                className="chq-detail-position-next"
                aria-label="Next submission"
              >
                Next &rsaquo;
              </Link>
            )}
          </div>
        )}
      </div>

      {error && <div className="chq-error-banner">{error}</div>}

      <header className="chq-detail-heading">
        {/* DEC-908: the ref now lives on the ref row above -- the H1 is
            detail.title alone. Eyebrow (tracks + format) and the placement
            subtitle travel with the title as one flex item. */}
        <div className="chq-detail-heading-title">
          {eyebrowText !== null && <p className="chq-detail-eyebrow">{eyebrowText}</p>}
          <h1>{detail.title}</h1>
          {/* DEC-828: only rendered once the session has an actual agenda
              placement -- schedule_slot has at most one row per submission,
              null means "not scheduled yet", never a blank/placeholder line. */}
          {detail.slot && (
            <p className="chq-detail-placement">
              <Link to="/agenda">{formatSubmissionScheduleLine(detail.slot)}</Link>
            </p>
          )}
        </div>
      </header>

      <div className="chq-detail-layout">
        <div className="chq-detail-main">
          {/* DEC-908 main column order: Abstract -> Form Answers -> Reviews
              -> Session Details. This is today's "Session details" section,
              retitled Abstract -- content and inline-edit behaviour
              unchanged. */}
          <section className="chq-detail-section">
            <h2 className="chq-detail-section-title">Abstract</h2>
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
                      onClick={closeEditing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* DEC-908: today's Answers section, retitled Form Answers and
              moved up to sit right after Abstract. Same 190px/1fr baseline
              grid with 1px hairline row rules the frame calls for (already
              .chq-answer-row's shape -- unchanged here). */}
          <section className="chq-detail-section">
            <h2 className="chq-detail-section-title">Form answers</h2>
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
            <h2 className="chq-detail-section-title">
              Reviews &middot; {evaluations.filter((ev) => ev.submittedAt !== null).length} of {evaluations.length} in
            </h2>
            <div className="chq-detail-section-body">
              {evaluationsError && <div className="chq-error-banner">{evaluationsError}</div>}
              {evaluations.length === 0 ? (
                <p>No reviews recorded yet.</p>
              ) : (
                <ul className="chq-review-list">
                  {evaluations.map((ev, i) => (
                    <li key={`${ev.planId}-${ev.round}-${i}`} className="chq-review-entry">
                      <div className="chq-review-entry-meta">
                        {/* DEC-736: the organiser is always told who
                            reviewed -- never render 'Anonymous reviewer',
                            even for an anonymized plan. */}
                        <strong>{ev.reviewerName}</strong>
                        <span className="chq-review-entry-score">{ev.score !== null ? ev.score.toFixed(1) : '—'}</span>
                        <span className="chq-review-entry-plan">
                          {ev.planName} &middot; Round {ev.round} &middot; {formatTimestamp(ev.submittedAt)}
                        </span>
                      </div>
                      {ev.criteria.length > 0 && (
                        <dl className="chq-review-scores">
                          {/* Criterion values render under criteria[].label
                              -- the raw criterionId key never reaches the
                              DOM (used only as the React list key). */}
                          {ev.criteria.map((criterion) => (
                            <div key={criterion.id} className="chq-review-score">
                              <dt>{criterion.label}</dt>
                              <dd>{ev.scores[criterion.id] ?? '—'}</dd>
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

          {/* DEC-908: ONE trailing "Session details" section holding today's
              Tracks/Format/Participants blocks verbatim (every behaviour --
              optimistic write, loud rollback, co-presenter search, role
              picker -- unchanged); only their placement moves here. */}
          <section className="chq-detail-section chq-detail-session-details">
            <h2 className="chq-detail-section-title">Session details</h2>
            <div className="chq-detail-section-body chq-detail-session-details-body">
              <div className="chq-detail-subsection">
                <h3 className="chq-detail-subsection-title">Tracks</h3>
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

              <div className="chq-detail-subsection">
                <h3 className="chq-detail-subsection-title">Format</h3>
                {formatError && <div className="chq-error-banner">{formatError}</div>}
                {formatField ? (
                  <select
                    id="submission-format"
                    className="chq-select"
                    aria-label="Format"
                    value={currentFormat}
                    disabled={formatPending}
                    onChange={(e) => changeFormat(e.target.value)}
                  >
                    <option value="">Not set</option>
                    {(formatField.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p>This event's form has no session format field.</p>
                )}
              </div>

              <div className="chq-detail-subsection">
                <h3 className="chq-detail-subsection-title">Participants</h3>
              {participantsError && <div className="chq-error-banner">{participantsError}</div>}
              {detail.participants.length === 0 ? (
                <p>No participants.</p>
              ) : (
                <>
                  {(() => {
                    // DEC-656: a speaker-added co-presenter lands
                    // visible=false (recorded, not published) — this
                    // caption is derived from the already-loaded
                    // detail.participants, no extra API field/endpoint.
                    const hiddenCount = detail.participants.filter((p) => !p.visible).length;
                    return hiddenCount > 0 ? (
                      <p className="chq-detail-participants-note">
                        {countOf(hiddenCount, 'speaker')} on this session are not on the public site yet — tick Visible to
                        publish them.
                      </p>
                    ) : null;
                  })()}
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
                        <td>{participantRoleLabel(p.role)}</td>
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
                </>
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
                <label>
                  Role
                  <select
                    className="chq-select"
                    aria-label="Role"
                    value={coPresenterRole}
                    onChange={(e) => setCoPresenterRole(e.target.value)}
                  >
                    {PARTICIPANT_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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
            </div>
          </section>
        </div>

        {/* DEC-908 rail order: Decision -> Speaker -> History. */}
        <aside className="chq-detail-aside">
          <section className="chq-detail-section chq-detail-decision">
            <h2 className="chq-detail-section-title">Decision</h2>
            <div className="chq-detail-section-body chq-detail-decision-body">
              <div className="chq-detail-decision-rail">
                {decidedStatus === null ? (
                  <>
                    <p className="chq-detail-triage-label">
                      Awaiting triage{triageDays !== null ? ` · ${countOf(triageDays, 'day')}` : ''}
                    </p>
                    <button
                      type="button"
                      className="chq-btn chq-btn-primary chq-detail-decision-primary"
                      disabled={statusPending}
                      onClick={() => changeStatus('accepted')}
                    >
                      {DECISION_ACTION_LABELS.accepted}
                    </button>
                    <div className="chq-detail-decision-secondary-pair">
                      <button
                        type="button"
                        className="chq-btn chq-btn-secondary"
                        disabled={statusPending}
                        onClick={() => changeStatus('declined')}
                      >
                        {DECISION_ACTION_LABELS.declined}
                      </button>
                      <button
                        type="button"
                        className="chq-btn chq-btn-secondary"
                        disabled={statusPending}
                        onClick={() => changeStatus('waitlisted')}
                      >
                        {DECISION_ACTION_LABELS.waitlisted}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="chq-detail-decision-stated">
                      {STATUS_LABELS[decidedStatus]}
                      {decidedLabel !== null ? ` · ${decidedLabel}` : ''}
                    </p>
                    <div className="chq-detail-decision-secondary-pair">
                      {DECIDABLE_STATUSES.filter((status) => status !== decidedStatus).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="chq-btn chq-btn-secondary"
                          disabled={statusPending}
                          onClick={() => changeStatus(status)}
                        >
                          {DECISION_ACTION_LABELS[status]}
                        </button>
                      ))}
                    </div>
                    {/* Exactly one un-decide path: a quiet link, never a
                        third 'Pending' choice among the decision buttons. */}
                    <button
                      type="button"
                      className="chq-link-button chq-detail-decision-back"
                      disabled={statusPending}
                      onClick={() => changeStatus('pending')}
                    >
                      Back to pending
                    </button>
                  </>
                )}
                <p className="chq-detail-decision-note">Deciding sends nothing. Notify from Comms.</p>
              </div>
              {/* Content approval lives on the content screen (worklist /
                  deliverable detail), not here -- this page only points at
                  it (DEC-743). */}
              <Link to={`/content/${id}`} className="chq-btn chq-btn-tertiary chq-detail-content-link">
                Review the content &rsaquo;
              </Link>
            </div>
          </section>

          {speaker && (
            <section className="chq-detail-section chq-detail-speaker">
              <h2 className="chq-detail-section-title">Speaker</h2>
              <div className="chq-detail-section-body chq-detail-speaker-body">
                <strong className="chq-detail-speaker-name">{speaker.name}</strong>
                {/* DEC-908 (wave 42 amendment): 'Company · Role' with a
                    middot, not the prior 'Role, Company' comma order. */}
                {(speaker.title || speaker.company) && (
                  <span className="chq-detail-speaker-role">
                    {[speaker.company, speaker.title].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span className="chq-detail-speaker-email">{speaker.email}</span>
              </div>
            </section>
          )}

          {/* DEC-908: History moves into the rail, below Speaker. Each
              entry renders on the frame's 96px/1fr 'when | what' grid --
              the grid itself is the separator, so the literal ' | ' span is
              gone. Show/Hide toggle, DEC-892 entry kinds, and the
              per-revision Restore button are unchanged. */}
          <section className="chq-detail-section chq-submission-history">
            {/* DEC-707 section-action grammar: a plain label above the 2px
                rule, the show/hide toggle rendered as the section's ONE
                action ON that same rule -- never a bare toggle-button
                standing in for the heading. */}
            <div className="chq-detail-section-title chq-detail-section-title-row">
              <span className="chq-detail-section-title-text">History</span>
              <button type="button" className="chq-detail-section-action chq-link-button" onClick={toggleHistory}>
                {historyOpen ? 'Hide' : 'Show'}
              </button>
            </div>
            {historyOpen && (
              <div className="chq-detail-section-body">
                {historyError && <div className="chq-error-banner">{historyError}</div>}
                {historyLoading ? (
                  <DelayedLoading label="Loading history…" />
                ) : historyEntries.length === 0 ? (
                  <p>No history recorded yet.</p>
                ) : (
                  <ul className="chq-submission-history-list">
                    {historyEntries.map((entry) => (
                      <li key={entry.id} className="chq-submission-history-entry">
                        {/* DEC-892 timeline entry on the frame's 96px/1fr
                            'when | what' grid -- the grid gap is the
                            separator, no literal ' | ' text. */}
                        <div className="chq-submission-history-row">
                          <span className="chq-submission-history-when">{formatTimestamp(entry.at)}</span>
                          <span className="chq-submission-history-what">
                            <strong>{entry.label}</strong>
                            {entry.detail ? <> &mdash; {entry.detail}</> : null}
                          </span>
                        </div>
                        {/* Only an 'edited' entry is a revision that can be
                            restored — a submitted/reviewed/emailed entry has
                            no prior content to put back. */}
                        {entry.kind === 'edited' && (
                          <button
                            type="button"
                            className="chq-btn chq-btn-tertiary"
                            disabled={restoringId === entry.id}
                            onClick={() => restoreRevision(entry.id)}
                          >
                            Restore
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
