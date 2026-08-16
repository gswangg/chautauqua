import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiList, apiPost, apiPostBlob, apiUpload, ApiError } from '../../lib/api';
import { CommentThread } from './CommentThread';
import { groupByKindNewestFirst, orderVersionChains } from './version-chain';
import { UploadZone } from './UploadZone';
import { VersionList } from './VersionList';
import { DelayedLoading } from '../../components/DelayedLoading';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { formatDate, formatDayLabel } from '../../lib/dates';
import { countOf } from '../../lib/plural';
import { publicRoomLabel } from '../../lib/room-label';
import { clockHHMM } from '../../lib/clock';
import {
  FILE_KINDS,
  DELIVERABLE_LABELS,
  type ContentStatus,
  type DeliverableFile,
  type FileKind,
  type FileComment,
} from './types';
import { worklistStatusLabel, worklistStatusEmphasisClass } from './worklist';
// DEC-761/DEC-998: code that depends on a decision must reference its
// constant.
import { DEC_998 } from '../../../../src/decisions';

void DEC_998;

// DEC-901: the header's speaker/CODE/slot subtitle and the CONTENT STATUS
// band both need fields the worklist row never carries (ref, participants,
// slot, updatedAt) -- fetched here straight from GET /api/v1/submissions/:id
// (src/server/repo/submissions/detail.ts's SubmissionDetail), the same
// endpoint ContentApp already uses for a Files-library deep link, just with
// the fields this header actually reads instead of ContentApp's narrower
// SubmissionLookup shape.
interface DeliverableHeaderParticipant {
  name: string;
  // DEC-998: one more column on the query DeliverableDetail already runs
  // (GET /submissions/:id -> getSubmissionDetail, which already SELECTs
  // participant.contactId for SubmissionDetail's own participants list) --
  // never a second by-ids fetch (DEC-734/DEC-992 precedent).
  contactId: string;
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
  // DEC-881: same predicate the worklist row/header read (reUploadedSql,
  // src/server/repo/submissions/list.ts) -- composed here, never re-derived,
  // so the band and the worklist row that opened it can never disagree.
  reuploaded: boolean;
  // DEC-020 amendment (wave 12): GET /submissions/:id -> getSubmissionDetail
  // already SELECTs contentStatus for SubmissionDetail -- carried here so
  // this header refetch is the ONE re-read that reconciles the displayed
  // pill after a write (upload) that moves content_status server-side
  // (files.ts's reopenContentReview), rather than trusting a mount-time
  // snapshot through a write it never sees.
  contentStatus: ContentStatus;
}

/** '<CODE> · <slot>, <Room>' (DEC-901) -- the leading speaker clause is
 * rendered separately (DEC-998: the shown speaker name is a link to their
 * contact record), and the slot/room clause is omitted entirely (not
 * printed as an empty '· ,') when the session hasn't been placed on the
 * agenda yet. Time is zero-padded HH:MM via the single clock owner (DEC-900). */
function formatDetailTrailer(detail: DeliverableHeaderDetail): string {
  const parts = [detail.ref];
  if (detail.slot) {
    const slotLabel = `${formatDayLabel(detail.slot.day)} ${clockHHMM(detail.slot.startMin)}–${clockHHMM(detail.slot.endMin)}`;
    parts.push(`${slotLabel}, ${publicRoomLabel(detail.slot.roomName)}`);
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
  // DEC-756/DEC-971: ONE deliverable CHAIN at a time — a chip scopes both
  // the version list and the note thread, and two independent chains of
  // the same kind get two separate chips (two v1 uploads of one kind are
  // two documents, not two versions of one). Selection is keyed by the
  // selected chain's head file id; default resolved below once files are
  // loaded (first chain of the first kind with files).
  const [selectedHeadId, setSelectedHeadId] = useState<string | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  // DEC-901: header-only data (subtitle + status band) -- absent (not a
  // fabricated placeholder) until this resolves, so the header renders the
  // title alone rather than a wrong/blank subtitle for a beat.
  const [headerDetail, setHeaderDetail] = useState<DeliverableHeaderDetail | null>(null);
  // DEC-020 wave-58 amendment: the organizer's own upload can reopen content
  // review exactly like the speaker portal's upload does — the 201 now
  // names it (`contentReviewReopened`), and this holds that receipt for the
  // most recent upload so the disclosure line below can render it. Reset on
  // every new upload attempt, never carried across submissions.
  const [uploadReopened, setUploadReopened] = useState(false);

  // DEC-020 amendment (wave 12): ONE content-status reader -- this is the
  // single GET this component ever issues for header/status data. Both the
  // mount effect below and handleUpload's post-write refetch call this same
  // function, so a server-side content_status move (reopenContentReview on
  // upload) is always re-read through the same path rather than trusted from
  // a stale mount-time snapshot.
  function loadHeader() {
    return apiGet<DeliverableHeaderDetail>(`/submissions/${submissionId}`)
      .then((detail) => {
        setHeaderDetail(detail);
        return detail;
      })
      .catch(() => {
        setHeaderDetail(null);
        return null;
      });
  }

  useEffect(() => {
    setHeaderDetail(null);
    void loadHeader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // DEC-971: chip strip (and therefore selection + version list + thread)
  // is built from CHAINS, not kinds -- two independent chains of one kind
  // (e.g. two separately-uploaded v1 presentations) get two chips, each
  // scoping its own version list and its own comment thread.
  const chainsList: { kind: FileKind; chain: DeliverableFile[] }[] = FILE_KINDS.flatMap((kind) =>
    orderVersionChains(files.filter((f) => f.kind === kind)).map((chain) => ({ kind, chain })),
  );
  const chainCountByKind: Record<FileKind, number> = {} as Record<FileKind, number>;
  for (const kind of FILE_KINDS) {
    chainCountByKind[kind] = chainsList.filter((c) => c.kind === kind).length;
  }

  useEffect(() => {
    for (const { chain } of chainsList) {
      const head = chain[0];
      if (head) void loadComments(head.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const defaultChain = chainsList[0] ?? null;
  const activeChain =
    (selectedHeadId ? chainsList.find((c) => c.chain[0]?.id === selectedHeadId) : undefined) ?? defaultChain;
  const activeKind = activeChain?.kind ?? FILE_KINDS[0];
  const activeVersions = activeChain?.chain ?? [];
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
    setUploadReopened(false);
    const result = await apiUpload<{ contentReviewReopened: boolean }>(`/submissions/${submissionId}/files`, form);
    const [, detail] = await Promise.all([loadFiles(), loadHeader()]);
    // DEC-020 amendment (wave 12): an upload can flip content_status server-
    // side (files.ts's reopenContentReview, approved -> pending) -- the
    // refetched header is the source of truth for the displayed pill after
    // this write, so it wins over whatever pill held before the upload.
    if (detail) {
      setPill(detail.contentStatus);
      onContentStatusChange(submissionId, detail.contentStatus);
    }
    // DEC-020 wave-58 amendment: the 201's own contentReviewReopened flag
    // (not a re-derivation from the refetched pill, which would also be true
    // for a submission that was ALREADY pending before this upload) drives
    // the disclosure line -- only a real reopen names the consequence.
    setUploadReopened(result.contentReviewReopened);
    onUploaded?.();
  }

  // DEC-720/DEC-741: the composer always sends through /content-note — a
  // note is never posted silently, it is always a message to the speaker.
  // requestChanges also moves content_status (never 'approved' — approval
  // stays a separate, silent action below).
  async function handleSendNote(fileId: string, body: string, requestChanges: boolean) {
    const result = await apiPost<{ sent: number; failed: { email: string; message: string }[]; recipients: number }>(
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

  // DEC-720 wave-32 amendment: content-status is a silent flip for ALL
  // three values, not just 'approved' — the bare content-status endpoint
  // never mails (files-content-status.ts MUST NEVER import a mailer). A
  // deliberate note+email still goes through handleSendNote/content-note
  // above; this is the separate, silent status-only move.
  async function setContentStatus(status: ContentStatus) {
    const previous = pill;
    setStatusPending(true);
    setError(null);
    setPill(status);
    try {
      await apiPost(`/submissions/${submissionId}/content-status`, { contentStatus: status });
      onContentStatusChange(submissionId, status);
    } catch (err) {
      setPill(previous);
      setError(err instanceof ApiError ? `Status update failed: ${err.message}` : 'Status update failed');
    } finally {
      setStatusPending(false);
    }
  }

  function handleApprove() {
    return setContentStatus('approved');
  }

  function handleRequestChanges() {
    return setContentStatus('changes_requested');
  }

  // w6-e (DEC-881): the band's status reads the SAME predicate the worklist
  // row does -- headerDetail.reuploaded, absent (false) only while the
  // header fetch hasn't resolved yet, never a fabricated guess.
  const statusLabel = worklistStatusLabel(pill, headerDetail?.reuploaded ?? false);
  const subtitleTrailer = headerDetail ? formatDetailTrailer(headerDetail) : null;
  // DEC-901/DEC-998: the shown speaker name (first participant, '+N' suffix
  // for the rest, unchanged from the prior plain-text form) is now a link
  // to that speaker's contact record.
  const [firstSpeaker, ...restSpeakers] = headerDetail?.participants ?? [];

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
              unplaced session -- see formatDetailTrailer. DEC-998: the shown
              speaker name is a link into their contact record, not plain
              text. */}
          {headerDetail && subtitleTrailer !== null && (
            <p className="chq-meta chq-content-detail-subtitle">
              {firstSpeaker ? (
                <>
                  <Link to={`/contacts?openContact=${firstSpeaker.contactId}`} className="chq-content-detail-speaker-link">
                    {firstSpeaker.name}
                  </Link>
                  {restSpeakers.length > 0 ? ` +${restSpeakers.length}` : ''}
                </>
              ) : (
                'No speakers'
              )}
              {` · ${subtitleTrailer}`}
            </p>
          )}
        </div>
        {/* DEC-998 / G13 lane-D fix (05-content--01, ruling A2): quiet
            turn-diet actions into the submission's open editor and its open
            history — tertiary links RIGHT-FLUSHED against the session title
            (the pattern the submission detail already uses), never a
            bordered button. The frame carries no button in the title row —
            "Download all" is the status band's tertiary. */}
        <p className="chq-content-detail-actions">
          <Link to={`/submissions/${submissionId}?edit=1`} className="chq-content-detail-action-link">
            Edit title and abstract &rsaquo;
          </Link>
          <Link to={`/submissions/${submissionId}?history=1`} className="chq-content-detail-action-link">
            Revision history &rsaquo;
          </Link>
        </p>
      </div>

      {/* DEC-901 amendment (wave 41): sunk CONTENT STATUS band -- states the
          current status and when it changed, and carries the Approve
          action that used to sit in its own .chq-content-status-bar next
          to the title column (deleted -- an element that only ever held
          this action and nothing else is chrome, not a second box).
          w5-i amendment: "Download all" moved OFF this band onto the
          header block above (chq-content-detail-head-actions) -- an export
          action is not a fact about the current status, it belongs beside
          the page's own H1. Content-status writes always bump
          the submission's own updatedAt
          (src/server/repo/files-content-status.ts sets both in the same
          UPDATE), the same "truthful for every status" precedent
          SubmissionDetailPage's decidedDateLabel already relies on for the
          decision rail -- so this is a real timestamp, not a guess. There
          is currently no actor column recorded anywhere for a
          content-status write (files-content-status.ts's
          updateContentStatus takes no editor/user id), so "by whom" is
          left off rather than fabricated; a future task needs a
          content-status audit column/table to fill that in honestly.

          DEC-989 amendment (wave 41, corrected wave 23): this band is
          chrome sitting on the page root's own box -- the same bare-rule
          idiom .chq-review-editor-title-row documents in review.css -- so
          it declares NO max-width of its own, and never reaches for
          100vw/cqw (.chq-main scrolls INTERNALLY, so viewport units
          overshoot its own scrollbar gutter). It DOES declare a negative
          margin-inline (content.css) to bleed past .chq-main's own
          padding; ContentApp puts NO measure token at all on the chq-page
          root in this state (not chq-measure-table -- that was itself the
          wave-41 defect DEC-989 corrects here), so this band and the
          header block above it are the page's only unclamped children --
          everything below them is wrapped in .chq-content-page-content,
          which delegates the 1180 measure instead. See content.css.

          DEC-989 amendment (wave 72): the band's copy stacks two lines
          ("Content status" label over the status value) and the value
          reads through worklistStatusLabel (worklist.ts) -- the SAME
          vocabulary the worklist row's status cell uses -- rather than a
          second label set (CONTENT_STATUS_LABELS).

          w6-e (DEC-881 amendment): reUploaded now threads through from
          GET /submissions/:id (SubmissionDetail.reuploaded, composed from
          the same reUploadedSql() the worklist row/header read) -- the band
          can no longer disagree with the worklist row that opened it. The
          value line is "<STATUS> · <since clause>" on one span, the
          existing honest "Updated <date>" meta supplying the since clause
          (no fabricated actor). Emphasis reads through ONE shared class
          mapping (worklist.ts's worklistStatusEmphasisClass, composed with
          content.css's .chq-content-status-muted / the base .chq-flag) that
          both this band and the worklist status cell consume. */}
      <div className="chq-content-status-band">
        <div className="chq-content-status-band-info">
          <div className="chq-content-status-band-copy">
            <span className="chq-content-status-band-label">Content status</span>
            <span className={['chq-flag', worklistStatusEmphasisClass(statusLabel)].filter(Boolean).join(' ')}>
              {statusLabel}
              {headerDetail ? ` · Updated ${formatDate(headerDetail.updatedAt)}` : ''}
            </span>
          </div>
        </div>
        <div className="chq-content-status-band-actions">
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
          {/* DEC-720 wave-32 amendment: 'changes_requested' is now reachable
              here too, silently (no note, no mail) -- the deliberate
              note+email path stays the CommentThread "Ask for changes"
              composer below, which is a distinct action, not this one. */}
          {pill !== 'changes_requested' && (
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={statusPending}
              onClick={() => void handleRequestChanges()}
            >
              Request changes
            </button>
          )}
          {/* G13 lane-D fix (05-content--01): the frame draws no 'Pending'
              control in the status band — [Approve] plus the Download-all
              tertiary only. */}
          <button
            type="button"
            className="chq-btn chq-btn-tertiary"
            disabled={downloadPending || !eventId}
            onClick={() => void handleDownloadAll()}
          >
            {downloadPending ? 'Downloading…' : 'Download all'}
          </button>
        </div>
      </div>

      {/* DEC-989 amendment (wave 23): everything below the status band is
          the reading body -- it delegates the page's 1180 measure here
          rather than the (now measure-less) chq-page root, so the header
          block and status band above stay unclamped chrome while this
          stays a clamped, centred reading column. content.css declares
          the clamp; this div adds no padding/margin of its own. */}
      <div className="chq-content-page-content">
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
          {/* DEC-901 amendment (wave 41): "Deliverables" (left) and "Notes on
              the <kind>" (right) are PEERS -- same top edge, each ruled
              across its OWN column -- so both headings now live inside
              their own .chq-content-*-col, as that column's first child,
              rather than "Deliverables" sitting above the whole two-column
              grid. The chip strip + its caption move down into the left
              column with it, since they scope the same deliverable the
              heading names. */}
          <div className="chq-content-group-body">
            <div className="chq-content-files-col">
              <h2 className="chq-section-label chq-content-deliverables-label">Deliverables</h2>
              {chainsList.length > 0 && (
                <>
                  <div className="chq-chipstrip" role="tablist" aria-label="Deliverable">
                    {chainsList.map(({ kind, chain }) => {
                      // orderVersionChains never returns an empty chain (see
                      // version-chain.ts); the non-null assertion just narrows
                      // the type TS otherwise can't infer from array indexing.
                      const head = chain[0]!;
                      const headId = head.id;
                      const isActive = activeChain?.chain[0]?.id === headId;
                      // DEC-971: only distinguished with a filename suffix when
                      // this kind holds more than one independent chain -- the
                      // common single-chain case stays the plain
                      // "<kind> · N versions" label.
                      const suffix = chainCountByKind[kind] > 1 ? ` · ${head.filename}` : '';
                      return (
                        <button
                          key={headId}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          className={isActive ? 'chq-pill is-active' : 'chq-pill'}
                          onClick={() => setSelectedHeadId(headId)}
                        >
                          {DELIVERABLE_LABELS[kind]} · {countOf(chain.length, 'version')}
                          {suffix}
                        </button>
                      );
                    })}
                  </div>
                  <p className="chq-meta chq-content-chip-caption">
                    Versions and notes below are for the selected deliverable
                  </p>
                </>
              )}
              <VersionList
                versions={activeVersions}
                onDeleted={() => void loadFiles()}
                contentStatus={pill}
                statusChangedAt={headerDetail?.updatedAt ?? null}
              />
              {/* DEC-020 wave-58 amendment: the organizer's own upload can
                  reopen content review exactly like the speaker portal's
                  does -- the portal already discloses this after the fact
                  ("Received your file for ... The session is off the public
                  schedule pending the producer's approval."); this is the
                  same disclosure in the organizer's own vocabulary, gated on
                  the 201's own contentReviewReopened flag rather than a
                  guess, and reset on every upload attempt (see
                  uploadReopened above). */}
              {uploadReopened && (
                <p role="status" className="chq-meta chq-content-upload-reopened-notice">
                  The new version is back with review and the session is off the public schedule until it is
                  approved again.
                </p>
              )}
              <UploadZone kind={activeKind} sessionTitle={title} replacesFileId={activeLatest?.id} onUpload={handleUpload} />
            </div>
            <div className="chq-content-comments-col">
              <h3 className="chq-section-label chq-content-notes-label">
                Notes on the {DELIVERABLE_LABELS[activeKind].toLowerCase()}
              </h3>
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
    </div>
  );
}
