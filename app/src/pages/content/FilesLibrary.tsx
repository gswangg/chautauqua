import { useCallback, useEffect, useState } from 'react';
import { apiList, apiPostBlob, ApiError } from '../../lib/api';
import { DELIVERABLE_KINDS, DELIVERABLE_LABELS, type DeliverableKind, type EventFileChainItem } from './types';
import { formatDateTime } from '../../lib/dates';
import { formatBytes } from './format';

interface FilesLibraryProps {
  eventId: string;
  onSelectSubmission: (submissionId: string) => void;
}

const PER_PAGE = 50;
// DEC-160/182's bulk-archive bound — the SPA must never let a selection
// grow past what POST /events/:eventId/files/archive will accept.
const MAX_ARCHIVE_FILES = 50;

/** CNT-13/CNT-14 (DEC-159/DEC-160/DEC-344): central files library — one row
 * per deliverable version chain across the whole event, server-paginated
 * and server-filtered (kind + search), with multi-select bulk ZIP download.
 * Row click drills into the same DeliverableDetail used by the worklist, so
 * the version list + comment thread stay one implementation. */
export function FilesLibrary({ eventId, onSelectSubmission }: FilesLibraryProps) {
  const [items, setItems] = useState<EventFileChainItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<DeliverableKind | ''>('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  // CNT-D5: the ZIP download fires a native <a download> click with no
  // other page feedback — this live region is the only in-page signal that
  // the request started, finished, or failed.
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    if (kind) params.set('kind', kind);
    if (q.trim() !== '') params.set('q', q.trim());
    apiList<EventFileChainItem>(`/events/${eventId}/files?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setSelected(new Set());
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load files'))
      .finally(() => setLoading(false));
  }, [eventId, page, kind, q]);

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

  // Select-all only ever selects the current page's rows — the library is
  // server-paginated (DEC-344), there's no "select every matching file
  // across the event" affordance.
  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.rootFileId))));
  }

  const overArchiveLimit = selected.size > MAX_ARCHIVE_FILES;

  async function downloadZip() {
    if (overArchiveLimit) return;
    setError(null);
    // CNT-14/CNT-D5: the disabled button alone is not feedback — the
    // live region must confirm generation is in flight before the
    // native <a download> click ever fires.
    setDownloadStatus('Preparing ZIP…');
    setDownloading(true);
    try {
      // Latest-version ids: resolveLatestVersions accepts any chain-member
      // id, but the library always surfaces latestFileId per DEC-159.
      const fileCount = selected.size;
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
      const fileWord = fileCount === 1 ? 'file' : 'files';
      setDownloadStatus(`${filename}: ${fileCount} ${fileWord}, ${formatBytes(blob.size)} downloaded.`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Download failed';
      setError(err instanceof ApiError ? `Download failed: ${err.message}` : 'Download failed');
      setDownloadStatus(message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="chq-files-library chq-content-files-library" data-testid="files-library">
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}

      <div className="chq-files-library-toolbar chq-content-files-toolbar">
        <label>
          Kind{' '}
          <select
            className="chq-select"
            aria-label="Filter by kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as DeliverableKind | '');
              setPage(1);
            }}
          >
            <option value="">All</option>
            {DELIVERABLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {DELIVERABLE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          className="chq-input"
          aria-label="Search files"
          placeholder="Search filename, session, or speaker"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <button
          type="button"
          className="chq-btn chq-btn-primary"
          disabled={selected.size === 0 || overArchiveLimit || downloading}
          aria-busy={downloading}
          onClick={downloadZip}
        >
          {downloading ? 'Downloading…' : `Download ZIP (${selected.size})`}
        </button>
        {overArchiveLimit && (
          <span className="chq-error chq-content-archive-limit" role="alert">
            Select at most {MAX_ARCHIVE_FILES} files to download as a ZIP.
          </span>
        )}
        <span className="chq-content-download-status" role="status">
          {downloadStatus}
        </span>
      </div>

      <table className="chq-table chq-content-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                className="chq-check"
                aria-label="Select all files on this page"
                checked={items.length > 0 && selected.size === items.length}
                onChange={toggleAll}
              />
            </th>
            <th>Filename</th>
            <th>Kind</th>
            <th>Session</th>
            <th>Speaker</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th>Versions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8}>Loading...</td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={8} className="chq-empty">
                No deliverable files yet.
              </td>
            </tr>
          )}
          {!loading &&
            items.map((item) => (
              <tr key={item.rootFileId} className="chq-content-row">
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="chq-check"
                    aria-label={`Select ${item.filename}`}
                    checked={selected.has(item.rootFileId)}
                    onChange={() => toggle(item.rootFileId)}
                  />
                </td>
                <td className="chq-content-row-title">
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
                <td className="chq-meta">{formatBytes(item.sizeBytes)}</td>
                <td className="chq-meta">{formatDateTime(item.uploadedAt)}</td>
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

      <div className="chq-files-library-pager chq-content-files-pager">
        <button type="button" className="chq-btn chq-btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} &middot; {total} total
        </span>
        <button
          type="button"
          className="chq-btn chq-btn-secondary"
          disabled={page * PER_PAGE >= total || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
