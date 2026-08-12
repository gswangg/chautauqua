import { formatBytes } from './format';
import { formatDateTime } from '../../lib/dates';
import { orderVersionChains } from './version-chain';
import type { DeliverableFile } from './types';

interface VersionListProps {
  versions: DeliverableFile[];
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
 * chain head still gets its own chain-relative "vN" (never "Latest"). */
export function VersionList({ versions }: VersionListProps) {
  if (versions.length === 0) {
    return <p className="chq-empty">No versions uploaded yet.</p>;
  }

  const chains = orderVersionChains(versions);

  return (
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
            </li>
          );
        }),
      )}
    </ul>
  );
}
