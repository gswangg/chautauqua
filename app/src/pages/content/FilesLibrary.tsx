import { useCallback, useEffect, useState } from 'react';
import { apiList, apiPostBlob, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { FILE_KINDS, DELIVERABLE_LABELS, type FileKind, type EventFileChainItem, type EventHeadshotFileItem } from './types';
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
type FilesTab = 'deliverables' | 'headshots';

export function FilesLibrary({ eventId, onSelectSubmission }: FilesLibraryProps) {
  const [tab, setTab] = useState<FilesTab>('deliverables');
  const [items, setItems] = useState<EventFileChainItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<FileKind | ''>('');
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
  // w1-f (DEC-733/eval 60/37): the library's stat line and deliverable-type
  // chips read from the list endpoint's OWN counts, never a tally of the
  // current page — a page-derived count would silently drop to whatever the
  // pagesize is once a library exceeds PER_PAGE. allCount/kindCounts are
  // page-1/perPage-1 reads against the same list endpoint (same q, no kind
  // filter), kept independent of `kind`/`page` so switching a chip or
  // paging never invalidates the others' counts.
  const [allCount, setAllCount] = useState<number | null>(null);
  const [kindCounts, setKindCounts] = useState<Record<FileKind, number> | null>(null);

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
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [eventId, page, kind, q]);

  useEffect(() => {
    load();
  }, [load]);

  const loadCounts = useCallback(() => {
    const baseParams = new URLSearchParams();
    baseParams.set('page', '1');
    baseParams.set('perPage', '1');
    if (q.trim() !== '') baseParams.set('q', q.trim());

    apiList<EventFileChainItem>(`/events/${eventId}/files?${baseParams.toString()}`)
      .then((res) => setAllCount(res.total))
      .catch(() => setAllCount(null));

    void Promise.all(
      FILE_KINDS.map((k) => {
        const kindParams = new URLSearchParams(baseParams);
        kindParams.set('kind', k);
        return apiList<EventFileChainItem>(`/events/${eventId}/files?${kindParams.toString()}`).then(
          (res) => [k, res.total] as const,
        );
      }),
    )
      .then((entries) => setKindCounts(Object.fromEntries(entries) as Record<FileKind, number>))
      .catch(() => setKindCounts(null));
  }, [eventId, q]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Headshots tab: a separate, separately-paginated query against the new
  // endpoint (DEC-669) — never unioned into the deliverable rows above.
  const [headshotItems, setHeadshotItems] = useState<EventHeadshotFileItem[]>([]);
  const [headshotTotal, setHeadshotTotal] = useState(0);
  const [headshotPage, setHeadshotPage] = useState(1);
  const [headshotLoading, setHeadshotLoading] = useState(false);
  const [headshotLoaded, setHeadshotLoaded] = useState(false);
  const [headshotError, setHeadshotError] = useState<string | null>(null);

  const loadHeadshots = useCallback(() => {
    setHeadshotLoading(true);
    setHeadshotError(null);
    const params = new URLSearchParams();
    params.set('page', String(headshotPage));
    params.set('perPage', String(PER_PAGE));
    apiList<EventHeadshotFileItem>(`/events/${eventId}/headshots?${params.toString()}`)
      .then((res) => {
        setHeadshotItems(res.items);
        setHeadshotTotal(res.total);
      })
      .catch((err) => setHeadshotError(err instanceof ApiError ? err.message : 'Failed to load headshots'))
      .finally(() => {
        setHeadshotLoading(false);
        setHeadshotLoaded(true);
      });
  }, [eventId, headshotPage]);

  useEffect(() => {
    if (tab === 'headshots') loadHeadshots();
  }, [tab, loadHeadshots]);

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
    // id, but the library always surfaces latestFileId per DEC-159.
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
      const res = await apiList<EventFileChainItem>(`/events/${eventId}/files?${params.toString()}`);
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

  return (
    <div className="chq-files-library chq-content-files-library" data-testid="files-library">
      <div className="chq-chipstrip" role="tablist" aria-label="Files view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'deliverables'}
          className={tab === 'deliverables' ? 'chq-pill is-active' : 'chq-pill'}
          onClick={() => setTab('deliverables')}
        >
          Deliverables
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'headshots'}
          className={tab === 'headshots' ? 'chq-pill is-active' : 'chq-pill'}
          onClick={() => setTab('headshots')}
        >
          Headshots
        </button>
      </div>

      {tab === 'headshots' ? (
        <div className="chq-content-headshots-tab" data-testid="headshots-tab">
          {headshotError && (
            <div className="chq-error" role="alert">
              {headshotError}
            </div>
          )}
          <table className="chq-table chq-content-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Speaker</th>
                <th>Company</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {headshotLoading && (
                <tr>
                  <td colSpan={4}>
                    <DelayedLoading />
                  </td>
                </tr>
              )}
              {headshotLoaded && !headshotLoading && headshotItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="chq-empty">
                    No speaker headshots yet.
                  </td>
                </tr>
              )}
              {!headshotLoading &&
                headshotItems.map((item) => (
                  <tr key={item.fileId} className="chq-content-row">
                    <td className="chq-content-row-title">
                      <a href={`/headshots/${item.fileId}`} target="_blank" rel="noreferrer">
                        {item.filename}
                      </a>
                    </td>
                    <td>{item.contactName}</td>
                    <td>{item.company ?? ''}</td>
                    <td className="chq-meta">{formatBytes(item.sizeBytes)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="chq-files-library-pager chq-content-files-pager">
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={headshotPage <= 1 || headshotLoading}
              onClick={() => setHeadshotPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>
              Page {headshotPage} &middot; {headshotTotal} total
            </span>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={headshotPage * PER_PAGE >= headshotTotal || headshotLoading}
              onClick={() => setHeadshotPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <>
      {error && (
        <div className="chq-error" role="alert">
          {error}
        </div>
      )}

      {/* w1-f (DEC-733/eval 60/37): stat line + Download all, both truthful
          against the list endpoint's own counts (never the loaded page) —
          mirrors the mock's 'N files' + Download all header
          (docs/design/'Chautauqua Content.dc.html', screens/05-content.png). */}
      <div className="chq-content-files-stat-row">
        <span className="chq-summary">{allCount === null ? 'Counting files…' : `${allCount} ${allCount === 1 ? 'file' : 'files'}`}</span>
        <button
          type="button"
          className="chq-btn chq-btn-secondary"
          disabled={downloading || allCount === null || allCount === 0}
          aria-busy={downloading}
          onClick={downloadAll}
        >
          Download all
        </button>
      </div>

      <div className="chq-files-library-toolbar chq-content-files-toolbar">
        <div className="chq-chipstrip" role="tablist" aria-label="Deliverable type">
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
          {FILE_KINDS.map((k) => (
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
              {DELIVERABLE_LABELS[k]} &middot; {kindCounts?.[k] ?? '…'}
            </button>
          ))}
        </div>
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
        </>
      )}
    </div>
  );
}
