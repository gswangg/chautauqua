import { useCallback, useEffect, useState } from 'react';
import { apiList, apiPostBlob, ApiError } from '../../lib/api';
import { DELIVERABLE_LABELS, type EventFileChainItem } from './types';
import { formatDateTime } from './format';

interface FilesLibraryProps {
  eventId: string;
  onSelectSubmission: (submissionId: string) => void;
}

/** CNT-13/CNT-14 (DEC-159/DEC-160): central files library — one row per
 * deliverable version chain across the whole event, with multi-select bulk
 * ZIP download. Row click drills into the same DeliverableDetail used by
 * the worklist, so the version list + comment thread stay one
 * implementation. */
export function FilesLibrary({ eventId, onSelectSubmission }: FilesLibraryProps) {
  const [items, setItems] = useState<EventFileChainItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiList<EventFileChainItem>(`/events/${eventId}/files`)
      .then((res) => {
        setItems(res.items);
        setSelected(new Set());
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load files'))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(rootFileId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rootFileId)) next.delete(rootFileId);
      else next.add(rootFileId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.rootFileId))));
  }

  async function downloadZip() {
    setError(null);
    setDownloading(true);
    try {
      // Latest-version ids: resolveLatestVersions accepts any chain-member
      // id, but the library always surfaces latestFileId per DEC-159.
      const fileIds = items.filter((i) => selected.has(i.rootFileId)).map((i) => i.latestFileId);
      const { blob, filename } = await apiPostBlob(`/events/${eventId}/files/archive`, { fileIds });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? `Download failed: ${err.message}` : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="chq-files-library" data-testid="files-library">
      {error && <div className="chq-error-banner">{error}</div>}

      <div className="chq-files-library-toolbar">
        <button type="button" disabled={selected.size === 0 || downloading} onClick={downloadZip}>
          Download ZIP ({selected.size})
        </button>
      </div>

      <table className="chq-content-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select all files"
                checked={items.length > 0 && selected.size === items.length}
                onChange={toggleAll}
              />
            </th>
            <th>Filename</th>
            <th>Kind</th>
            <th>Session</th>
            <th>Speaker</th>
            <th>Uploaded</th>
            <th>Versions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7}>Loading...</td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={7}>No deliverable files yet.</td>
            </tr>
          )}
          {!loading &&
            items.map((item) => (
              <tr key={item.rootFileId} className="chq-content-row">
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.filename}`}
                    checked={selected.has(item.rootFileId)}
                    onChange={() => toggle(item.rootFileId)}
                  />
                </td>
                <td>
                  {item.submissionId ? (
                    <button
                      type="button"
                      className="chq-link-button"
                      aria-label={`Open ${item.filename} versions and comments`}
                      onClick={() => onSelectSubmission(item.submissionId)}
                    >
                      {item.filename}
                    </button>
                  ) : (
                    item.filename
                  )}
                </td>
                <td>{DELIVERABLE_LABELS[item.kind]}</td>
                <td>
                  {item.submissionId ? (
                    <button
                      type="button"
                      className="chq-link-button"
                      aria-label={`Open ${item.filename} versions and comments`}
                      onClick={() => onSelectSubmission(item.submissionId)}
                    >
                      {item.submissionRef} {item.submissionTitle}
                    </button>
                  ) : (
                    <>
                      {item.submissionRef} {item.submissionTitle}
                    </>
                  )}
                </td>
                <td>{item.speakerName}</td>
                <td>{formatDateTime(item.uploadedAt)}</td>
                <td>
                  {item.submissionId ? (
                    <button
                      type="button"
                      className="chq-link-button"
                      aria-label={`Open ${item.filename} versions and comments`}
                      onClick={() => onSelectSubmission(item.submissionId)}
                    >
                      {item.versionCount}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
