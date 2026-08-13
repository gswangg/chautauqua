import { useEffect, useState } from 'react';
import { apiGet, apiList, apiPost, apiPostBlob, apiUpload, ApiError } from '../../lib/api';
import { CommentThread } from './CommentThread';
import { groupByKindNewestFirst } from './version-chain';
import { UploadZone } from './UploadZone';
import { VersionList } from './VersionList';
import { DelayedLoading } from '../../components/DelayedLoading';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { formatDate, formatDayLabel } from '../../lib/dates';
import {
  CONTENT_STATUS_LABELS,
  FILE_KINDS,
  DELIVERABLE_LABELS,
  type ContentStatus,
  type DeliverableFile,
  type FileKind,
  type FileComment,
} from './types';

// DEC-901: the header's speaker/CODE/slot subtitle and the CONTENT STATUS
// band both need fields the worklist row never carries (ref, participants,
// slot, updatedAt) -- fetched here straight from GET /api/v1/submissions/:id
// (src/server/repo/submissions/detail.ts's SubmissionDetail), the same
// endpoint ContentApp already uses for a Files-library deep link, just with
// the fields this header actually reads instead of ContentApp's narrower
// SubmissionLookup shape.
interface DeliverableHeaderParticipant {
  name: string;
}

interface DeliverableHeaderSlot {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
}

interface DeliverableHeaderDetail {
  ref: string;
  updatedAt: number;
  participants: DeliverableHeaderParticipant[];
  slot: DeliverableHeaderSlot | null;
}

const ROOM_TBA_LABEL = 'To be announced';

function formatClockTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 'Speaker · <CODE> · <slot>, <Room>' (DEC-901) -- the slot/room clause is
 * omitted entirely (not printed as an empty '· ,') when the session hasn't
 * been placed on the agenda yet. */
function formatDetailSubtitle(detail: DeliverableHeaderDetail): string {
  const [firstSpeaker, ...restSpeakers] = detail.participants;
  const speakerLabel = firstSpeaker
    ? `${firstSpeaker.name}${restSpeakers.length > 0 ? ` +${restSpeakers.length}` : ''}`
    : 'No speakers';
  const parts = [speakerLabel, detail.ref];
  if (detail.slot) {
    const slotLabel = `${formatDayLabel(detail.slot.day)} ${formatClockTime(detail.slot.startMin)}–${formatClockTime(detail.slot.endMin)}`;
    parts.push(`${slotLabel}, ${detail.slot.roomName ?? ROOM_TBA_LABEL}`);
  }
  return parts.join(' · ');
}

interface DeliverableDetailProps {
  submissionId: string;
  title: string;
  contentStatus: ContentStatus;
  onBack: () => void;
  onContentStatusChange: (submissionId: string, status: ContentStatus) => void;
  /** w1-e: invoked after a successful upload so callers (ContentApp) can
   * invalidate any cached list that surfaces version counts, e.g. the
   * Files library, without this component knowing that list exists. */
  onUploaded?: () => void;
}

export function DeliverableDetail({
  submissionId,
  title,
  contentStatus,
  onBack,
  onContentStatusChange,
  onUploaded,
}: DeliverableDetailProps) {
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [filesTotal, setFilesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentsByFile, setCommentsByFile] = useState<Record<string, FileComment[]>>({});
  const [statusPending, setStatusPending] = useState(false);
  const [pill, setPill] = useState<ContentStatus>(contentStatus);
  const { eventId } = useCurrentEvent();
  // DEC-756: ONE deliverable at a time — a chip scopes both the version
  // list and the note thread. Local selection state; default resolved
  // below once files are loaded (first kind with files, else first kind).
  const [selectedKind, setSelectedKind] = useState<FileKind | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  // DEC-901: header-only data (subtitle + status band) -- absent (not a
  // fabricated placeholder) until this resolves, so the header renders the
  // title alone rather than a wrong/blank subtitle for a beat.
  const [headerDetail, setHeaderDetail] = useState<DeliverableHeaderDetail | null>(null);

  useEffect(() => {
    setHeaderDetail(null);
    apiGet<DeliverableHeaderDetail>(`/submissions/${submissionId}`)
      .then((detail) => setHeaderDetail(detail))
      .catch(() => setHeaderDetail(null));
  }, [submissionId]);

  function loadFiles() {
    setLoading(true);
    setError(null);
    return apiList<DeliverableFile>(`/submissions/${submissionId}/files`)
      .then((res) => {
        setFiles(res.items);
        setFilesTotal(res.total);
        return res.items;
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load deliverables');
        return [];
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const grouped = groupByKindNewestFirst(files);

  // DEC-468: /files/:fileId/comments now carries a `total` alongside
  // `items`, but commentsByFile is keyed per-file with no matching
  // per-file total slot, and every call site renders the full thread (no
  // per-thread pagination UI exists yet) -- adding a truncation sentence
  // here would need a second per-fileId map for no visible behavior change
  // today, so this is left alone per this task's scope (res.total is
  // available at this call site if a future task needs it).
  async function loadComments(fileId: string) {
    try {
      const res = await apiList<FileComment>(`/files/${fileId}/comments`);
      setCommentsByFile((prev) => ({ ...prev, [fileId]: res.items }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load comments');
    }
  }

  useEffect(() => {
    for (const kind of FILE_KINDS) {
      const latest = grouped[kind][0];
      if (latest) void loadComments(latest.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const kindsWithFiles = FILE_KINDS.filter((kind) => grouped[kind].length > 0);
  const defaultKind = kindsWithFiles[0] ?? FILE_KINDS[0];
  const activeKind = selectedKind && (kindsWithFiles.length === 0 || kindsWithFiles.includes(selectedKind))
    ? selectedKind
    : defaultKind;
  const activeVersions = grouped[activeKind];
  const activeLatest = activeVersions[0];

  async function handleDownloadAll() {
    if (!eventId) return;
    setDownloadStatus('Preparing ZIP…');
    setDownloadPending(true);
    setError(null);
    try {
      const fileIds = FILE_KINDS.map((kind) => grouped[kind][0]?.id).filter((id): id is string => Boolean(id));
      const { blob, filename } = await apiPostBlob(`/events/${eventId}/files/archive`, { fileIds });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloadStatus(`${filename} downloaded.`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Download failed';
      setError(err instanceof ApiError ? `Download failed: ${err.message}` : 'Download failed');
      setDownloadStatus(message);
    } finally {
      setDownloadPending(false);
    }
  }

  async function handleUpload(file: File, kind: FileKind, replacesFileId?: string) {
    const form = new FormData();
    form.set('file', file);
    form.set('kind', kind);
    if (replacesFileId) form.set('replacesFileId', replacesFileId);
    await apiUpload(`/submissions/${submissionId}/files`, form);
    await loadFiles();
    onUploaded?.();
  }

  // DEC-720/DEC-741: the composer always sends through /content-note — a
  // note is never posted silently, it is always a message to the speaker.
  // requestChanges also moves content_status (never 'approved' — approval
  // stays a separate, silent action below).
  async function handleSendNote(fileId: string, body: string, requestChanges: boolean) {
    const result = await apiPost<{ sent: number; failed: { email: string; message: string }[] }>(
      `/submissions/${submissionId}/content-note`,
      { fileId, body, requestChanges },
    );
    if (requestChanges) {
      setPill('changes_requested');
      onContentStatusChange(submissionId, 'changes_requested');
    }
    await loadComments(fileId);
    return result;
  }

  // DEC-720: approval is the one status move that stays a silent flip —
  // it asks nothing of the speaker, so it keeps using content-status
  // directly rather than the mailer-carrying content-note endpoint.
  async function handleApprove() {
    const previous = pill;
    setStatusPending(true);
    setError(null);
    setPill('approved');
    try {
      await apiPost(`/submissions/${submissionId}/content-status`, { contentStatus: 'approved' });
      onContentStatusChange(submissionId, 'approved');
    } catch (err) {
      setPill(previous);
      setError(err instanceof ApiError ? `Status update failed: ${err.message}` : 'Status update failed');
    } finally {
      setStatusPending(false);
    }
  }

  const subtitle = headerDetail ? formatDetailSubtitle(headerDetail) : null;

  return (
    <div className="chq-deliverable-detail chq-content-detail">
      {/* DEC-901: the back link stands on its own line above the title --
          the frame anatomy the rest of the product's detail pages use
          (see SubmissionDetailPage's chq-detail-topbar), not a button
          crowded next to the H1. */}
      <div className="chq-content-detail-topbar">
        <button type="button" className="chq-link-button chq-content-detail-back" onClick={onBack}>
          &lsaquo; Content
        </button>
      </div>
      <div className="chq-content-detail-head">
        <div className="chq-content-detail-title-col">
          <h1 className="chq-page-title chq-content-detail-title">{title}</h1>
          {/* DEC-901: 'Speaker · CODE · slot, Room' -- withheld (not a blank
              line) until the header fetch resolves, and the slot/room
              clause is entirely absent (never an empty '· ,') for an
              unplaced session -- see formatDetailSubtitle. */}
          {subtitle && <p className="chq-meta chq-content-detail-subtitle">{subtitle}</p>}
        </div>
        <div className="chq-content-status-bar">
          {/* DEC-756/DEC-733: Approve renders only while the session is not
              already approved -- an action that cannot apply is absent,
              never disabled. */}
          {pill !== 'approved' && (
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              disabled={statusPending}
              onClick={() => void handleApprove()}
            >
              Approve
            </button>
          )}
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={downloadPending || !eventId}
            onClick={() => void handleDownloadAll()}
          >
            {downloadPending ? 'Downloading…' : 'Download all'}
          </button>
        </div>
      </div>

      {/* DEC-901: sunk CONTENT STATUS band -- states the current status and
          when it changed. Content-status writes always bump the
          submission's own updatedAt (src/server/repo/files-content-status.ts
          sets both in the same UPDATE), the same "truthful for every
          status" precedent SubmissionDetailPage's decidedDateLabel already
          relies on for the decision rail -- so this is a real timestamp,
          not a guess. There is currently no actor column recorded anywhere
          for a content-status write (files-content-status.ts's
          updateContentStatus takes no editor/user id), so "by whom" is
          left off rather than fabricated; a future task needs a
          content-status audit column/table to fill that in honestly. */}
      <div className="chq-content-status-band">
        <span className="chq-content-status-band-label">Content status</span>
        <span className={pill === 'changes_requested' ? 'chq-flag' : 'chq-flag chq-content-status-muted'}>
          {CONTENT_STATUS_LABELS[pill]}
        </span>
        {headerDetail && (
          <span className="chq-meta chq-content-status-band-updated">Updated {formatDate(headerDetail.updatedAt)}</span>
        )}
      </div>

      {downloadStatus && (
        <p className="chq-meta chq-content-download-status" role="status">
          {downloadStatus}
        </p>
      )}

      {error && <div className="chq-error" role="alert">{error}</div>}
      {loading && <DelayedLoading label="Loading deliverables…" />}
      {!loading && files.length < filesTotal && (
        // DEC-468: submissions/:id/files is now server-paginated -- disclose
        // the truncation rather than letting the group view quietly imply
        // it holds every version.
        <p className="chq-meta">
          Showing first {files.length} of {filesTotal} versions.
        </p>
      )}

      {!loading && (
        <div className="chq-content-detail-body">
          {/* DEC-901: DELIVERABLES section rule over the files -- the same
              chq-section-label vocabulary the notes column already uses
              below, never a parallel heading style. */}
          <h2 className="chq-section-label chq-content-deliverables-label">Deliverables</h2>
          {kindsWithFiles.length > 0 && (
            <>
              <div className="chq-chipstrip" role="tablist" aria-label="Deliverable">
                {kindsWithFiles.map((kind) => {
                  const n = grouped[kind].length;
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="tab"
                      aria-selected={activeKind === kind}
                      className={activeKind === kind ? 'chq-pill is-active' : 'chq-pill'}
                      onClick={() => setSelectedKind(kind)}
                    >
                      {DELIVERABLE_LABELS[kind]} · {n} version{n === 1 ? '' : 's'}
                    </button>
                  );
                })}
              </div>
              <p className="chq-meta chq-content-chip-caption">
                Versions and notes below are for the selected deliverable
              </p>
            </>
          )}

          <div className="chq-content-group-body">
            <div className="chq-content-files-col">
              <VersionList
                versions={activeVersions}
                onDeleted={() => void loadFiles()}
                contentStatus={pill}
                statusChangedAt={headerDetail?.updatedAt ?? null}
              />
              <UploadZone kind={activeKind} replacesFileId={activeLatest?.id} onUpload={handleUpload} />
            </div>
            <div className="chq-content-comments-col">
              <h3 className="chq-section-label">Notes on the {DELIVERABLE_LABELS[activeKind].toLowerCase()}</h3>
              {activeLatest && (
                <CommentThread
                  comments={commentsByFile[activeLatest.id] ?? []}
                  onSend={(body, requestChanges) => handleSendNote(activeLatest.id, body, requestChanges)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
