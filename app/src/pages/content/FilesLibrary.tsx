import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPostBlob, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import {
  LIBRARY_KINDS,
  LIBRARY_KIND_LABELS,
  HEADSHOT_KIND,
  type LibraryKind,
  type EventFileChainItem,
  type EventFilesEnvelope,
} from './types';
import { formatDateTime } from '../../lib/dates';
import { formatBytes } from './format';

interface FilesLibraryProps {
  eventId: string;
  onSelectSubmission: (submissionId: string) => void;
  // DEC-902: the library gets the frame's own page header (breadcrumb, H1
  // 'Files') -- onBack is the breadcrumb's real destination (back to the
  // Content worklist), never a decorative link.
  onBack: () => void;
}

const PER_PAGE = 50;
// DEC-160/182's bulk-archive bound — the SPA must never let a selection
// grow past what POST /events/:eventId/files/archive will accept.
const MAX_ARCHIVE_FILES = 50;

/** DEC-773: the files library is ONE list — deliverable version chains AND
 * speaker headshots (kind='headshot'), server-paginated and server-filtered
 * (kind + search), with multi-select bulk ZIP download and a per-row
 * Download link. Row click drills into the same DeliverableDetail used by
 * the worklist for a deliverable row; a headshot row has no submission to
 * drill into.
 *
 * DEC-902: the kind-chip counts and the total/size stat all come from the
 * SAME GET /events/:eventId/files response the table itself renders from —
 * kindCounts is one `group by kind` aggregate the server computes over
 * event-scope + q (never the caller's selected kind), so switching chips
 * never invalidates another chip's own printed number. There is no
 * separate per-kind fan-out and no separate unfiltered "totals" call. */
export function FilesLibrary({ eventId, onSelectSubmission, onBack }: FilesLibraryProps) {
  const [items, setItems] = useState<EventFileChainItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalSizeBytes, setTotalSizeBytes] = useState(0);
  const [kindCounts, setKindCounts] = useState<Record<LibraryKind, number> | null>(null);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<LibraryKind | ''>('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
    apiGet<EventFilesEnvelope>(`/events/${eventId}/files?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setTotalSizeBytes(res.totalSizeBytes);
        setKindCounts(res.kindCounts);
        setSelected(new Set());
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load files'))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
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

  // Shared with downloadAll below — the archive endpoint (test/zip.test.ts,
  // POST /events/:eventId/files/archive) is the ONE zip path; a 'Download
  // all' affordance that didn't call it would be decorative.
  async function runArchiveDownload(fileIds: string[]) {
    setError(null);
    // CNT-14/CNT-D5: the disabled button alone is not feedback — the
    // live region must confirm generation is in flight before the
    // native <a download> click ever fires.
    setDownloadStatus('Preparing ZIP…');
    setDownloading(true);
    try {
      const fileCount = fileIds.length;
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

  async function downloadZip() {
    if (overArchiveLimit) return;
    // Latest-version ids: resolveLatestVersions accepts any chain-member
    // id (deliverable or headshot), but the library always surfaces
    // latestFileId per DEC-159/773.
    const fileIds = items.filter((i) => selected.has(i.rootFileId)).map((i) => i.latestFileId);
    await runArchiveDownload(fileIds);
  }

  // w1-f: 'Download all' — every file matching the CURRENT kind/search
  // filters (never just the loaded page), bounded by the same
  // MAX_ARCHIVE_FILES the row-selection ZIP already enforces. When the
  // match count exceeds the cap it refuses with the same loud message
  // rather than silently truncating.
  async function downloadAll() {
    setError(null);
    setDownloadStatus('Preparing ZIP…');
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('perPage', String(MAX_ARCHIVE_FILES));
      if (kind) params.set('kind', kind);
      if (q.trim() !== '') params.set('q', q.trim());
      const res = await apiGet<EventFilesEnvelope>(`/events/${eventId}/files?${params.toString()}`);
      if (res.total > MAX_ARCHIVE_FILES) {
        const message = `This view has ${res.total} files; Download all is limited to ${MAX_ARCHIVE_FILES}. Narrow the search or type filter, or select files individually.`;
        setError(message);
        setDownloadStatus(message);
        setDownloading(false);
        return;
      }
      const fileIds = res.items.map((i) => i.latestFileId);
      await runArchiveDownload(fileIds);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Download failed';
      setError(err instanceof ApiError ? `Download failed: ${err.message}` : 'Download failed');
      setDownloadStatus(message);
      setDownloading(false);
    }
  }

  // DEC-773: a headshot file is served through /headshots/:fileId (the
  // gated route profile.tsx mounts), never /files/:fileId — the two
  // populations are structurally disjoint (submission_id null vs. not).
  function downloadHref(item: EventFileChainItem): string {
    return item.kind === HEADSHOT_KIND ? `/headshots/${item.latestFileId}` : `/files/${item.latestFileId}`;
  }

  return (
    <div className="chq-files-library chq-content-files-library" data-testid="files-library">
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}

      {/* DEC-902: the frame's own page header — breadcrumb back to Content,
          H1 'Files', and the total/size stat ON this same row (never a
          separate band below it). */}
      <div className="chq-content-files-header-row">
        <div className="chq-content-files-titles">
          <button type="button" className="chq-link-button chq-content-files-breadcrumb" onClick={onBack}>
            &lsaquo; Content
          </button>
          <h1 className="chq-page-title">Files</h1>
        </div>
        <div className="chq-content-files-header-actions">
          <span className="chq-summary">
            {`${total} ${total === 1 ? 'file' : 'files'} · ${formatBytes(totalSizeBytes)}`}
          </span>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            disabled={downloading || total === 0}
            aria-busy={downloading}
            onClick={downloadAll}
          >
            Download all
          </button>
        </div>
      </div>

      <div className="chq-files-library-toolbar chq-content-files-toolbar">
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
        <div className="chq-chipstrip" role="tablist" aria-label="File type">
          <button
            type="button"
            role="tab"
            aria-selected={kind === ''}
            className={kind === '' ? 'chq-pill is-active' : 'chq-pill'}
            onClick={() => {
              setKind('');
              setPage(1);
            }}
          >
            All types
          </button>
          {/* DEC-902: a kind with zero matches offers no chip -- a filter
              that can only empty the list is a dead control. kindCounts is
              read straight from the SAME envelope the table renders from,
              never re-fetched per kind. */}
          {LIBRARY_KINDS.filter((k) => (kindCounts?.[k] ?? 0) > 0).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={kind === k ? 'chq-pill is-active' : 'chq-pill'}
              onClick={() => {
                setKind(k);
                setPage(1);
              }}
            >
              {LIBRARY_KIND_LABELS[k]} &middot; {kindCounts?.[k] ?? 0}
            </button>
          ))}
        </div>
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

      <table className="chq-table chq-content-table chq-content-files-table">
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
            <th>File</th>
            <th>Kind</th>
            <th>Session</th>
            <th className="chq-content-files-col-version">Version</th>
            <th className="chq-content-files-col-size">Size</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8}>
                <DelayedLoading />
              </td>
            </tr>
          )}
          {loaded && !loading && items.length === 0 && (
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
                  <div className="chq-content-file-cell">
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
                      <span>{item.filename}</span>
                    )}
                    <span className="chq-meta chq-content-file-who">{item.uploaderName ?? ''}</span>
                  </div>
                </td>
                <td>{LIBRARY_KIND_LABELS[item.kind]}</td>
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
                <td className="chq-content-files-col-version">v{item.versionNo}</td>
                <td className="chq-meta chq-content-files-col-size">{formatBytes(item.sizeBytes)}</td>
                <td className="chq-meta">{formatDateTime(item.uploadedAt)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <a
                    className="chq-link-button"
                    href={downloadHref(item)}
                    aria-label={`Download ${item.filename}`}
                  >
                    Download
                  </a>
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
