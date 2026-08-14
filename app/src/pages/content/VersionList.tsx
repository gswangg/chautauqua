import { useState } from 'react';
import { formatBytes } from './format';
import { formatDateTime } from '../../lib/dates';
import { orderVersionChains } from './version-chain';
import { apiDelete, ApiError } from '../../lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ContentStatus, DeliverableFile } from './types';

interface VersionListProps {
  versions: DeliverableFile[];
  /** DEC-713: called after a version is successfully deleted so the caller
   * (DeliverableDetail) can reload the list — this component never owns the
   * source-of-truth list itself. */
  onDeleted: () => void;
  /** DEC-901: best-available signal for "uploaded after a changes-requested
   * decision". There is no persisted content-status history anywhere in the
   * schema (files-content-status.ts's updateContentStatus takes no
   * before/after log) -- only the submission's CURRENT contentStatus plus
   * the timestamp that status took effect (updatedAt, bumped in the same
   * write, the same precedent DeliverableDetail's CONTENT STATUS band and
   * SubmissionDetailPage's decidedDateLabel both already rely on). A
   * version uploaded after that instant, while the submission still reads
   * changes_requested, is annotated; both optional so existing callers that
   * don't have this data yet simply render without the annotation rather
   * than crash. */
  contentStatus?: ContentStatus;
  statusChangedAt?: number | null;
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
 * Only the single newest file overall carries "Latest", and DEC-901 requires
 * it read "v<N> · Latest" (number AND marker, never the marker alone) --
 * every other chain head still gets its own chain-relative "vN" (never
 * "Latest"). A row a later upload in its OWN chain superseded carries
 * REPLACED.
 *
 * DEC-713: this surface is organizer-only (mounted from the admin Content
 * app), so an organizer may delete any version here — the quiet Delete
 * tertiary renders on every row, confirmed through the shared ConfirmDialog
 * (never window.confirm), and refreshes the list on success. */
export function VersionList({ versions, onDeleted, contentStatus, statusChangedAt }: VersionListProps) {
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
            // DEC-901/965: the newest row always names its version number
            // AND the marker -- never the marker alone, so the one row that
            // matters isn't the only row whose position in the chain can't
            // be read. DEC-965: the tag reads the row's own STORED
            // version_no (a version number is an identity, not a chain
            // position) so a deleted middle version never renumbers its
            // surviving siblings. w5-i: the marker itself ("NEWEST") moved
            // out of the tag into its own right-aligned badge (see
            // .chq-content-version-newest below) rather than trailing the
            // version number inline.
            const tag = `v${v.versionNo}`;
            // DEC-901: a row superseded by a later upload in the SAME
            // chain (idxInChain > 0 means this chain's own head, at index
            // 0, replaced it) carries REPLACED -- never across unrelated
            // chains, which are independent documents, not versions of
            // each other (version-chain.ts).
            const isReplaced = idxInChain > 0;
            const isAfterChangesRequested =
              contentStatus === 'changes_requested' && statusChangedAt != null && v.createdAt > statusChangedAt;
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
                  {isReplaced && (
                    <span className="chq-content-version-flag chq-content-version-flag-replaced">REPLACED</span>
                  )}
                  {isAfterChangesRequested && (
                    <span className="chq-content-version-flag chq-content-version-flag-changes">
                      Uploaded after changes were requested
                    </span>
                  )}
                </div>
                {/* w5-i: always present (empty on every non-current row) so
                    the row's grid column count never shifts Download/Delete
                    -- see content.css. */}
                <span className="chq-content-version-newest">{isCurrent ? 'NEWEST' : ''}</span>
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
