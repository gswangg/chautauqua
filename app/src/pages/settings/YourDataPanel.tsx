// 'Your data' settings section (w3-d, DEC-747/DEC-728): ONE numbered
// section (docs/design/Chautauqua Settings.dc.html lines 198-233) whose
// rows are Exports, API tokens, API docs and Import from Sessionboard --
// converging DEC-691's two-panel composition (ExportsPanel + ApiTokensPanel
// stacked as separate top-level panels) into the mock's single section.
//
// Exports row: the mock shows exactly four pills (Submissions CSV,
// Contacts CSV, Schedule ICS, Everything JSON). Two of those already exist
// as real endpoints (DEC-027 'submissions'/'contacts' kinds, format=csv)
// and are linked directly. 'Schedule ICS' has no DEC-027 kind -- the
// closest real, already-shipped capability is the public full-agenda feed
// at GET /e/:slug/agenda.ics (EMB-15/DEC-289), so that's what the pill
// links to rather than a fabricated event-scoped ICS export. 'Everything
// JSON' has no single server endpoint either; rather than link to a URL
// that 404s or silently mislabel one kind's export as "everything", this
// button walks every DEC-027 kind's JSON export client-side and bundles
// them into one downloaded file -- honest (uses only real endpoints,
// mirrors what a combined export would contain) and requires no server
// change. Per "chrome fidelity never deletes a capability" (FINDINGS
// w21), the full per-kind CSV/JSON table (speakers, evaluations,
// email-log, showflow -- kinds the mock's four pills don't cover) stays
// reachable via "More export formats", not deleted.
//
// API tokens row: ApiTokensPanel, embedded unchanged -- same reveal-once
// creation flow, same name/masked-value/last-used/Revoke row shape the
// mock calls for. Its create button is relabelled "New token" to match
// the mock's primary-button copy; no other behavior changes.
//
// Import from Sessionboard row: a row that drills into the existing
// three-step SessionboardImportPanel, unchanged, the same on/off drill
// pattern PublicPagesPanel already uses for its embed builder.
//
// SummarySection adoption (w6-e, DEC-815): the landing view is a
// read-only summary of the four rows above; the live pieces (export
// pills/bundle button, ApiTokensPanel's create/revoke flow and the
// Sessionboard import wizard) live behind the section's 'Change' drill
// (?section=your-data&edit=1, DEC-728/DEC-710). The API docs link stays
// visible in the summary -- it is a passive navigation, not a form.
//
// DEC-815 amendment (wave 4): the summary rows for 'Exports' and 'API
// tokens' used to describe their sets in a sentence instead of listing
// them. 'Exports' now renders the same real export links/button the edit
// branch renders (renderExportPills, shared by both so there is only one
// place that lists the four pills); 'API tokens' now renders ApiTokensPanel
// in its new `readOnly` mode -- the same component the edit branch already
// mounts, never a second list renderer, with no create/revoke control at
// rest.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ApiTokensPanel } from './ApiTokensPanel';
import { ExportsPanel } from './ExportsPanel';
import { SessionboardImportPanel } from './SessionboardImportPanel';
import { SummarySection } from './SummarySection';
import { DEC_385, DEC_728, DEC_919 } from '../../../../src/decisions';
import './settings-drill-rows.css';

void DEC_385; // new page-local sheet, settings-drill-rows.css
void DEC_728; // the 390 drill frame's own Exports rows, not a second tap
void DEC_919; // phone-only export row list, desktop pill strip hidden at phone

const SECTION_KEY = 'your-data';

interface EventSummary {
  id: string;
  slug: string;
}

// The DEC-027 kinds bundled into "Everything JSON" -- every kind that
// export/:kind already serves for this event (excludes nothing; 'contacts'
// is org-scoped per DEC-597 but rides the same route/format machinery).
const EVERYTHING_KINDS = ['submissions', 'speakers', 'evaluations', 'agenda', 'email-log', 'contacts'] as const;

export function YourDataPanel() {
  // Host-derived display text, not a hard-coded deployment hostname (DEC-296
  // amendment, w7-d): this instance's actual host, same pattern as
  // FormsPage.tsx's submission-URL display text. Computed in the component
  // body (render time), NOT at module scope -- a module-level
  // `window.location` read crashes every node-environment test that merely
  // imports this module (e.g. section-key-parity.scan.test.ts, which parses
  // Settings.tsx's panel graph). The anchors' href stays root-relative
  // ("/docs/api") at both call sites below.
  const apiDocsDisplay = `${window.location.host}/docs/api`;
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [moreExportsOpen, setMoreExportsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bundling, setBundling] = useState(false);
  const [skippedKinds, setSkippedKinds] = useState<{ kind: string; message: string }[] | null>(null);

  useEffect(() => {
    if (!eventId) return;
    // DEC-856 (wave 71 amendment): clear the page-level banner before the
    // read is issued -- so a stale refusal never sits beside a later
    // successful reload (TracksRoomsPanel's shape).
    setError(undefined);
    apiGet<EventSummary>(`/events/${eventId}`)
      .then(setEvent)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load event'));
  }, [eventId]);

  // DEC-815 (wave-41 amendment): 'Everything JSON' fails PER KIND, not per
  // bundle. Each kind is fetched independently (Promise.allSettled, not a
  // serial loop that aborts on the first refusal) -- a kind the server
  // refuses (e.g. an over-cap email-log/evaluations export) is named on
  // screen with the server's own message and left out of the bundle, but
  // every kind that succeeded still downloads. Only when EVERY kind fails
  // does this fall back to today's single-error behaviour (no download).
  async function downloadEverythingJson() {
    if (!eventId) return;
    setBundling(true);
    setError(undefined);
    setSkippedKinds(null);
    try {
      const results = await Promise.allSettled(
        EVERYTHING_KINDS.map((kind) =>
          apiGet<unknown>(`/events/${eventId}/export/${kind}?format=json`).then((data) => ({ kind, data })),
        ),
      );

      const bundle: Record<string, unknown> = {};
      const present: string[] = [];
      const skipped: { kind: string; message: string }[] = [];

      results.forEach((result, index) => {
        const kind: (typeof EVERYTHING_KINDS)[number] = EVERYTHING_KINDS[index]!;
        if (result.status === 'fulfilled') {
          bundle[result.value.kind] = result.value.data;
          present.push(kind);
        } else {
          const err = result.reason;
          skipped.push({ kind, message: err instanceof ApiError ? err.message : 'Failed to export this kind' });
        }
      });

      if (present.length === 0) {
        // Every kind refused: keep today's single-error behaviour (no
        // download, no per-kind list) rather than the disclose-per-kind
        // shape below, which only applies once at least one kind survives.
        setError('Failed to build the combined export');
        return;
      }

      // Bundle records which kinds are present rather than silently
      // omitting the ones that failed.
      bundle._kinds = present;
      if (skipped.length > 0) {
        bundle._skipped = skipped;
      }

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'everything.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setSkippedKinds(skipped.length > 0 ? skipped : null);
    } finally {
      setBundling(false);
    }
  }

  // The set of export kinds the mock's four pills stand for -- ONE list,
  // shared by the pill strip (renderExportPills) and the phone-only row
  // list (renderExportRowsPhone, DEC-919 wave-99 amendment) so there is
  // still only one place that lists the four (DEC-815 amendment, wave 4;
  // the "no second list of export kinds" rule extends to the phone rows).
  // 'Everything, JSON' has no href -- it is a button in both renderings.
  interface ExportItem {
    key: string;
    name: string;
    detail: string;
    href?: string;
  }

  function exportItems(): ExportItem[] {
    if (!eventId) return [];
    const items: ExportItem[] = [
      {
        key: 'submissions',
        name: 'Submissions CSV',
        detail: 'CSV, every submission',
        href: `/api/v1/events/${eventId}/export/submissions?format=csv`,
      },
      {
        key: 'contacts',
        name: 'Contacts CSV',
        detail: 'CSV, every contact',
        href: `/api/v1/events/${eventId}/export/contacts?format=csv`,
      },
    ];
    if (event) {
      items.push({
        key: 'schedule',
        name: 'Schedule ICS',
        detail: 'Full agenda feed',
        href: `/e/${event.slug}/agenda.ics`,
      });
    }
    items.push({ key: 'everything', name: 'Everything, JSON', detail: 'Every export kind, bundled' });
    return items;
  }

  // The four real export links/button the mock's pills stand for -- shared
  // between the summary row (read-at-rest) and the edit branch so there is
  // only one place that renders this list (DEC-815 amendment, wave 4).
  function renderExportPills() {
    if (!eventId) return null;
    return (
      <>
        {exportItems().map((item) =>
          item.href ? (
            <a key={item.key} className="chq-pill" href={item.href}>
              {item.name}
            </a>
          ) : (
            <button
              key={item.key}
              type="button"
              className="chq-pill"
              disabled={bundling}
              onClick={() => void downloadEverythingJson()}
            >
              {bundling ? 'Building…' : item.name}
            </button>
          ),
        )}
        {skippedKinds && skippedKinds.length > 0 ? (
          <div role="status" className="chq-settings-row-note">
            {skippedKinds.map(({ kind, message }) => (
              <p key={kind}>
                {kind}: {message}
              </p>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  // docs/design/Chautauqua Settings.dc.html:409 `border:1px solid
  // #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px;
  // display:flex; align-items:center; padding:0 14px; font-size:13px;
  // font-weight:600` -- the Exports 390 drill draws a name-over-detail
  // row beside a separate boxed "Download" action, which `.chq-pill`
  // (name and action fused into one element) can never present. DEC-919
  // wave-99 amendment: this is the phone-only sibling of the pill strip
  // above -- same items, same hrefs/handler, so a click here reaches the
  // exact same endpoint or bundling function as its desktop pill.
  function renderExportRowsPhone() {
    if (!eventId) return null;
    return (
      <div className="chq-settings-drillrow-exports-phone">
        {exportItems().map((item) => (
          <div key={item.key} className="chq-settings-drillrow-export-row">
            <div className="chq-settings-drillrow-export-info">
              <span className="chq-settings-drillrow-export-name">{item.name}</span>
              <span className="chq-settings-drillrow-export-detail">{item.detail}</span>
            </div>
            {item.href ? (
              <a className="chq-settings-drillrow-export-download" href={item.href}>
                Download
              </a>
            ) : (
              <button
                type="button"
                className="chq-settings-drillrow-export-download"
                disabled={bundling}
                onClick={() => void downloadEverythingJson()}
              >
                {bundling ? 'Building…' : 'Download'}
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  const rows = [
    {
      label: 'Exports',
      value: <div className="chq-settings-summary-pills">{renderExportPills()}</div>,
    },
    { label: 'API tokens', value: <ApiTokensPanel readOnly /> },
    {
      label: 'API docs',
      value: <a href="/docs/api">{apiDocsDisplay}</a>,
    },
    { label: 'Import from Sessionboard', value: 'Import speakers and sessions from a Sessionboard export' },
  ];

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      <SummarySection sectionKey={SECTION_KEY} label="Your data" rows={rows} actionLabel="Change" editing={editing}>
        <div className="chq-settings-row">
          <span className="chq-settings-row-label">Exports</span>
          <div className="chq-settings-row-value">
            <div className="chq-settings-drillrow-pills-desktop">{renderExportPills()}</div>
            {eventId ? (
              <button type="button" className="chq-link-button" onClick={() => setMoreExportsOpen((v) => !v)}>
                {moreExportsOpen ? 'Hide more export formats' : 'More export formats'}
              </button>
            ) : null}
          </div>
        </div>
        {renderExportRowsPhone()}
        {moreExportsOpen ? <ExportsPanel /> : null}

        <ApiTokensPanel />

        <div className="chq-settings-row">
          <span className="chq-settings-row-label">API docs</span>
          <div className="chq-settings-row-value">
            <a href="/docs/api">{apiDocsDisplay}</a>
          </div>
        </div>

        <div className="chq-settings-row">
          <span className="chq-settings-row-label">Import from Sessionboard</span>
          <div className="chq-settings-row-value">
            {importOpen ? (
              <SessionboardImportPanel />
            ) : (
              <button type="button" className="chq-link-button" onClick={() => setImportOpen(true)}>
                Import from Sessionboard
              </button>
            )}
          </div>
        </div>
      </SummarySection>
    </>
  );
}
