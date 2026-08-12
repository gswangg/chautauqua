import { useEffect, useState } from 'react';
import { apiList, apiPost, apiUpload, ApiError } from '../../lib/api';
import { CommentThread } from './CommentThread';
import { groupByKindNewestFirst } from './version-chain';
import { UploadZone } from './UploadZone';
import { VersionList } from './VersionList';
import {
  CONTENT_STATUS_LABELS,
  FILE_KINDS,
  DELIVERABLE_LABELS,
  type ContentStatus,
  type DeliverableFile,
  type FileKind,
  type FileComment,
} from './types';

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

  async function handleUpload(file: File, kind: FileKind, replacesFileId?: string) {
    const form = new FormData();
    form.set('file', file);
    form.set('kind', kind);
    if (replacesFileId) form.set('replacesFileId', replacesFileId);
    await apiUpload(`/submissions/${submissionId}/files`, form);
    await loadFiles();
    onUploaded?.();
  }

  async function handlePostComment(fileId: string, body: string) {
    await apiPost(`/files/${fileId}/comments`, { body });
    await loadComments(fileId);
  }

  async function handleStatusChange(next: ContentStatus) {
    const previous = pill;
    setStatusPending(true);
    setError(null);
    setPill(next);
    try {
      await apiPost(`/submissions/${submissionId}/content-status`, { contentStatus: next });
      onContentStatusChange(submissionId, next);
    } catch (err) {
      setPill(previous);
      setError(err instanceof ApiError ? `Status update failed: ${err.message}` : 'Status update failed');
    } finally {
      setStatusPending(false);
    }
  }

  return (
    <div className="chq-deliverable-detail chq-content-detail">
      <button type="button" className="chq-btn chq-btn-tertiary" onClick={onBack}>
        &larr; Back to worklist
      </button>
      <div className="chq-content-detail-head">
        <h2 className="chq-page-title chq-content-detail-title">{title}</h2>
        <div className="chq-content-status-bar">
          <span className={pill === 'changes_requested' ? 'chq-flag' : 'chq-flag chq-content-status-muted'}>
            {CONTENT_STATUS_LABELS[pill]}
          </span>
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            disabled={statusPending}
            onClick={() => void handleStatusChange('approved')}
          >
            Approve
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={statusPending}
            onClick={() => void handleStatusChange('changes_requested')}
          >
            Ask for changes
          </button>
        </div>
      </div>

      {error && <div className="chq-error" role="alert">{error}</div>}
      {loading && <p>Loading deliverables...</p>}
      {!loading && files.length < filesTotal && (
        // DEC-468: submissions/:id/files is now server-paginated -- disclose
        // the truncation rather than letting the group view quietly imply
        // it holds every version.
        <p className="chq-meta">
          Showing first {files.length} of {filesTotal} versions.
        </p>
      )}

      {!loading &&
        FILE_KINDS.map((kind) => {
          const versions = grouped[kind];
          const latest = versions[0];
          return (
            <section key={kind} className="chq-deliverable-group chq-content-group">
              <div className="chq-section-head">
                <span className="chq-section-label">{DELIVERABLE_LABELS[kind]}</span>
              </div>
              <div className="chq-content-group-body">
                <div className="chq-content-files-col">
                  <VersionList versions={versions} />
                  <UploadZone kind={kind} replacesFileId={latest?.id} onUpload={handleUpload} />
                </div>
                <div className="chq-content-comments-col">
                  {latest && (
                    <CommentThread
                      comments={commentsByFile[latest.id] ?? []}
                      onPost={(body) => handlePostComment(latest.id, body)}
                    />
                  )}
                </div>
              </div>
            </section>
          );
        })}
    </div>
  );
}
