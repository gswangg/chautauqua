import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPostBlob, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { EmptyState } from '../../components/EmptyState';
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
import { countOf } from '../../lib/plural';
import { ARCHIVE_MAX_FILES, ARCHIVE_MAX_TOTAL_BYTES, archiveCapMessage } from '../../../../src/domain/files';

interface FilesLibraryProps {
  eventId: string;
  onSelectSubmission: (submissionId: string) => void;
  // DEC-902: the library gets the frame's own page header (breadcrumb, H1
  // 'Files') -- onBack is the breadcrumb's real destination (back to the
  // Content worklist), never a decorative link.
  onBack: () => void;
}

const PER_PAGE = 50;

// DEC-160 (wave-26 amendment, CNT-14): the header's scoped "Download all"
// mirrors the archive endpoint's own caps (src/domain/files.ts
// ARCHIVE_MAX_FILES / ARCHIVE_MAX_TOTAL_BYTES, wave-53 amendment: imported
// from pure core, not hand-copied) so the control can disable itself with a
// true reason before ever posting, rather than always firing and letting
// the server bounce it.

// DEC-678 amendment (B7): names each exact facet narrowing an empty
// result set — search text and/or the active kind chip — so the reason
// line never reads as a generic "try something else".
function filesFilterReason(q: string, kind: LibraryKind | ''): string {
  const parts: string[] = [];
  if (q.trim() !== '') parts.push(`search "${q.trim()}"`);
  if (kind !== '') parts.push(`type "${LIBRARY_KIND_LABELS[kind]}"`);
  return `Filtered by ${parts.join(' and ')}.`;
}

/** DEC-773: the files library is ONE list — deliverable version chains AND
 * speaker headshots (kind='headshot'), server-paginated and server-filtered
 * (kind + search), with a per-row Download link. Row click drills into the
 * same DeliverableDetail used by the worklist for a deliverable row; a
 * headshot row has no submission to drill into.
 *
 * Amendment (wave 41): five columns — FILE / SESSION / VERSION / SIZE /
 * Download. There is no per-row selection column here — the archive
 * endpoint (POST /events/:eventId/files/archive) has exactly one caller,
 * this header's own scoped 'Download all N (.zip)' control (DEC-901
 * amendment, wave-53 correction: this comment previously claimed there was
 * no bulk ZIP control at all, which contradicted the button below).
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
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);

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

  // DEC-773: a headshot file is served through /headshots/:fileId (the
  // gated route profile.tsx mounts), never /files/:fileId — the two
  // populations are structurally disjoint (submission_id null vs. not).
  function downloadHref(item: EventFileChainItem): string {
    return item.kind === HEADSHOT_KIND ? `/headshots/${item.latestFileId}` : `/files/${item.latestFileId}`;
  }

  // Amendment (wave 41): uploader + upload date fold into the FILE cell's
  // subline instead of their own column — em dash when the uploader is
  // unknown so the row never reads as blank.
  function whoLine(item: EventFileChainItem): string {
    const who = item.uploaderName ?? '—';
    return `${who} · ${formatDateTime(item.uploadedAt)}`;
  }

  // DEC-160 (wave-26 amendment, CNT-14): scoped to the currently-rendered
  // set (this page's rows), never the whole-event total — matching
  // MAX_ARCHIVE_FILES keeps a full page always downloadable in one shot.
  const visibleTotalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
  const overCap = items.length > ARCHIVE_MAX_FILES || visibleTotalBytes > ARCHIVE_MAX_TOTAL_BYTES;

  async function handleDownloadAll() {
    if (!eventId || items.length === 0) return;
    setDownloadPending(true);
    setError(null);
    try {
      const fileIds = items.map((item) => item.latestFileId);
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
      setDownloadPending(false);
    }
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
            {`${countOf(total, 'file')} · ${formatBytes(totalSizeBytes)}`}
          </span>
          {/* CNT-14 (DEC-160, wave-26 amendment): a bordered SECONDARY
              control scoped to the currently-rendered set, never a filled
              primary and never a second selection mechanism (the worklist's
              checkbox bulk-approve bar is a different control entirely).
              Conditional-and-quiet: absent on an empty set, disabled with a
              readable reason once the set exceeds the archive endpoint's own
              caps rather than firing a request the server would reject. */}
          {items.length > 0 && (
            <span className="chq-content-files-download-all-wrap">
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                disabled={overCap || downloadPending}
                onClick={() => void handleDownloadAll()}
              >
                {downloadPending
                  ? 'Downloading…'
                  : `Download all ${items.length} (.zip)`}
              </button>
              {overCap && <span className="chq-meta chq-content-files-download-all-cap">{archiveCapMessage()}</span>}
            </span>
          )}
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
      </div>

      {loading ? (
        <table className="chq-table chq-content-table chq-content-files-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Session</th>
              <th className="chq-content-files-col-version">Version</th>
              <th className="chq-content-files-col-size">Size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5}>
                <DelayedLoading />
              </td>
            </tr>
          </tbody>
        </table>
      ) : loaded && items.length === 0 ? (
        // DEC-678 amendment (B7): a loaded, empty visible set never renders
        // the <table> — a full <thead> over a one-cell apology is exactly
        // the pattern B7 forbids. A search/kind facet narrows the set, so an
        // empty result under one is 'filtered' (names the facet, offers a
        // single escape that clears it); with no facet in flight it's
        // 'fresh' -- and 'fresh' never offers a primary action here, since
        // files arrive from speakers, not from a control on this page
        // (DESIGN-RULINGS §B7 rule 3: no fake/disabled action where the
        // producer of the row can't act).
        q.trim() !== '' || kind !== '' ? (
          <EmptyState
            variant="filtered"
            what="No deliverable files yet."
            reason={filesFilterReason(q, kind)}
            escape={{
              label: 'Clear filters',
              onClick: () => {
                setQ('');
                setKind('');
                setPage(1);
              },
            }}
          />
        ) : (
          <EmptyState variant="fresh" what="No deliverable files yet." />
        )
      ) : (
        <table className="chq-table chq-content-table chq-content-files-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Session</th>
              <th className="chq-content-files-col-version">Version</th>
              <th className="chq-content-files-col-size">Size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.rootFileId} className="chq-content-row">
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
                    <span className="chq-meta chq-content-file-who">{whoLine(item)}</span>
                  </div>
                </td>
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
                    // w5-i: a headshot has no submission -- an empty cell
                    // read as a data gap, not a structural fact. A
                    // headshot's Session cell states that plainly instead
                    // of rendering blank.
                    <span className="chq-meta chq-content-file-no-session">No session — speaker headshot</span>
                  )}
                </td>
                <td className="chq-content-files-col-version chq-content-files-version-tag">v{item.versionNo}</td>
                <td className="chq-meta chq-content-files-col-size">{formatBytes(item.sizeBytes)}</td>
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
      )}

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
