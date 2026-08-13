import { useState } from 'react';
import { formatBytes } from './format';
import { formatDateTime } from '../../lib/dates';
import { orderVersionChains } from './version-chain';
import { apiDelete, ApiError } from '../../lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { DeliverableFile } from './types';

interface VersionListProps {
  versions: DeliverableFile[];
  /** DEC-713: called after a version is successfully deleted so the caller
   * (DeliverableDetail) can reload the list — this component never owns the
   * source-of-truth list itself. */
  onDeleted: () => void;
}

/** Newest-first version history for one deliverable kind (DEC-020). The
 * matching UploadZone below always targets the latest version's
 * replacesFileId, so there's no separate "replace" action here.
 *
 * `versions` may span more than one independent previousFileId chain (a
 * task-upload chain and a separately-uploaded organizer chain can coexist
 * for the same submission+kind) -- version numbers are computed PER CHAIN
 * (via orderVersionChains), not by flat position in the combined list, so
 * two unrelated documents never get mislabeled as versions of each other.
 * Only the single newest file overall is labeled "Latest"; every other
 * chain head still gets its own chain-relative "vN" (never "Latest").
 *
 * DEC-713: this surface is organizer-only (mounted from the admin Content
 * app), so an organizer may delete any version here — the quiet Delete
 * tertiary renders on every row, confirmed through the shared ConfirmDialog
 * (never window.confirm), and refreshes the list on success. */
export function VersionList({ versions, onDeleted }: VersionListProps) {
  const [pendingDelete, setPendingDelete] = useState<DeliverableFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (versions.length === 0) {
    return <p className="chq-empty">No versions uploaded yet.</p>;
  }

  const chains = orderVersionChains(versions);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await apiDelete(`/files/${pendingDelete.id}`);
      setPendingDelete(null);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete version');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {error && <div className="chq-error" role="alert">{error}</div>}
      <ul className="chq-version-list chq-content-version-list">
        {chains.map((chain, chainIdx) =>
          chain.map((v, idxInChain) => {
            const isCurrent = chainIdx === 0 && idxInChain === 0;
            const tag = isCurrent ? 'Latest' : `v${chain.length - idxInChain}`;
            return (
              <li key={v.id} className={isCurrent ? 'chq-version-item chq-content-version-item is-current' : 'chq-version-item chq-content-version-item'}>
                <span className="chq-content-version-tag">{tag}</span>
                <div className="chq-content-version-info">
                  <a href={`/files/${v.id}`} target="_blank" rel="noreferrer" className="chq-content-version-name">
                    {v.filename}
                  </a>
                  <span className="chq-version-meta chq-meta">
                    {v.uploaderName ?? 'Uploaded in the admin'} &middot; {formatDateTime(v.createdAt)} &middot;{' '}
                    {formatBytes(v.sizeBytes)}
                  </span>
                </div>
                <a href={`/files/${v.id}`} download className="chq-content-version-download">
                  Download
                </a>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary chq-content-version-delete"
                  onClick={() => setPendingDelete(v)}
                >
                  Delete
                </button>
              </li>
            );
          }),
        )}
      </ul>
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this version?"
          body={`"${pendingDelete.filename}" will be removed. This can't be undone.`}
          confirmLabel="Delete"
          destructive
          pending={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
