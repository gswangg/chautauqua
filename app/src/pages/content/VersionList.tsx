import { formatBytes, formatDateTime } from './format';
import type { DeliverableFile } from './types';

interface VersionListProps {
  versions: DeliverableFile[];
}

/** Newest-first version history for one deliverable kind (DEC-020). The
 * matching UploadZone below always targets the latest version's
 * replacesFileId, so there's no separate "replace" action here. */
export function VersionList({ versions }: VersionListProps) {
  if (versions.length === 0) {
    return <p className="chq-empty">No versions uploaded yet.</p>;
  }

  return (
    <ul className="chq-version-list">
      {versions.map((v, idx) => (
        <li key={v.id} className="chq-version-item">
          <a href={`/files/${v.id}`} target="_blank" rel="noreferrer">
            {v.filename}
          </a>
          <span className="chq-version-meta">
            {idx === 0 ? 'Latest' : `v${versions.length - idx}`} &middot; {v.uploaderName ?? 'Unknown uploader'} &middot;{' '}
            {formatDateTime(v.createdAt)} &middot; {formatBytes(v.sizeBytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}
