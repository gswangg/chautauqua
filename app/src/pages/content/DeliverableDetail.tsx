import { useEffect, useState } from 'react';
import { apiList, apiPost, apiUpload, ApiError } from '../../lib/api';
import { CommentThread } from './CommentThread';
import { groupByKindNewestFirst } from './version-chain';
import { UploadZone } from './UploadZone';
import { VersionList } from './VersionList';
import {
  CONTENT_STATUS_LABELS,
  DELIVERABLE_KINDS,
  DELIVERABLE_LABELS,
  type ContentStatus,
  type DeliverableFile,
  type DeliverableKind,
  type FileComment,
} from './types';

interface DeliverableDetailProps {
  submissionId: string;
  title: string;
  contentStatus: ContentStatus;
  onBack: () => void;
  onContentStatusChange: (submissionId: string, status: ContentStatus) => void;
}

export function DeliverableDetail({ submissionId, title, contentStatus, onBack, onContentStatusChange }: DeliverableDetailProps) {
  const [files, setFiles] = useState<DeliverableFile[]>([]);
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

  async function loadComments(fileId: string) {
    try {
      const res = await apiList<FileComment>(`/files/${fileId}/comments`);
      setCommentsByFile((prev) => ({ ...prev, [fileId]: res.items }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load comments');
    }
  }

  useEffect(() => {
    for (const kind of DELIVERABLE_KINDS) {
      const latest = grouped[kind][0];
      if (latest) void loadComments(latest.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  async function handleUpload(file: File, kind: DeliverableKind, replacesFileId?: string) {
    const form = new FormData();
    form.set('file', file);
    form.set('kind', kind);
    if (replacesFileId) form.set('replacesFileId', replacesFileId);
    await apiUpload(`/submissions/${submissionId}/files`, form);
    await loadFiles();
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
    <div className="chq-deliverable-detail">
      <button type="button" onClick={onBack}>
        &larr; Back to worklist
      </button>
      <h2>{title}</h2>
      <div className="chq-content-status-bar">
        <span className={`chq-status-pill chq-content-status-${pill}`}>{CONTENT_STATUS_LABELS[pill]}</span>
        <button type="button" disabled={statusPending} onClick={() => void handleStatusChange('approved')}>
          Approve
        </button>
        <button type="button" disabled={statusPending} onClick={() => void handleStatusChange('changes_requested')}>
          Request changes
        </button>
      </div>

      {error && <div className="chq-error-banner">{error}</div>}
      {loading && <p>Loading deliverables...</p>}

      {!loading &&
        DELIVERABLE_KINDS.map((kind) => {
          const versions = grouped[kind];
          const latest = versions[0];
          return (
            <section key={kind} className="chq-deliverable-group">
              <h3>{DELIVERABLE_LABELS[kind]}</h3>
              <VersionList versions={versions} />
              <UploadZone kind={kind} replacesFileId={latest?.id} onUpload={handleUpload} />
              {latest && (
                <CommentThread
                  comments={commentsByFile[latest.id] ?? []}
                  onPost={(body) => handlePostComment(latest.id, body)}
                />
              )}
            </section>
          );
        })}
    </div>
  );
}
