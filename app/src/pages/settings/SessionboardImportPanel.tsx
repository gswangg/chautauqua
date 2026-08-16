// Sessionboard import settings panel (task-w5-c, DEC-613/614): layer 3 of
// the Sessionboard importer -- the operator UI over the one-endpoint,
// one-planner wire contract fixed by DEC-613 (POST
// /api/v1/events/:eventId/import/sessionboard, { dryRun, entity, csvText,
// mapping } -> { dryRun, entity, created, updated, skipped, issues }).
// Independent of the server task (task-w5-b): this file mocks the network
// in its render test and builds strictly to the DEC-613 wire shape.
//
// Three steps, matching the visual grammar of "Import CSV · step 2 of 3" in
// docs/design/Chautauqua Contacts.dc.html (lines 248-269): (1) choose the
// Sessionboard entity + paste/upload its CSV export, (2) a mapping table of
// `column | sample value | -> | target field`, the target picker a styled
// .chq-segmented pill group (never a bare <select>) and the file input the
// shared styled .chq-file control (never a raw input[type=file]), (3) a
// dry-run report that prints only the numbers the server's report
// contains, then an explicit "Import N rows" confirm that re-posts with
// dryRun:false through the same planner.
//
// DEC-614: this build only ships Sessionboard's CSV/XLSX export path
// (layer 1). The REST-API-token path (layer 2) is named in prose next to
// the working control -- never rendered as a disabled button, a spinner
// that never resolves, or a simulator.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { parseCsv } from '../contacts/csv';
import { MAX_IMPORT_CSV_BYTES } from '../../lib/domain-caps';
import { formatBytes } from '../../../../src/domain/files';

export type SessionboardEntity = 'contacts' | 'submissions' | 'tracks' | 'participants';

const ENTITIES: { entity: SessionboardEntity; label: string }[] = [
  { entity: 'contacts', label: 'Contacts' },
  { entity: 'submissions', label: 'Submissions' },
  { entity: 'tracks', label: 'Tracks' },
  { entity: 'participants', label: 'Participants' },
];

// Target field vocabularies, one per entity, drawn from the app's own
// domain shapes (contacts: app/src/pages/contacts/csv.ts's
// STANDARD_IMPORT_FIELDS; submissions/tracks: the `submission`/`track`
// table columns in migrations/0000_secret_matthew_murdock.sql) -- not from
// any fixture or Sessionboard-specific vocabulary, since the server's
// mapping target names are the authority this UI must match once
// task-w5-b lands.
const TARGET_FIELDS: Record<SessionboardEntity, string[]> = {
  contacts: ['firstName', 'lastName', 'email', 'company', 'title', 'phone', 'bio'],
  submissions: ['title', 'description', 'trackName', 'status'],
  tracks: ['name', 'color'],
  participants: ['sessionExternalId', 'speakerExternalId', 'speakerEmail', 'role', 'order'],
};

const IGNORE_TARGET = '';

interface ImportReport {
  dryRun: boolean;
  entity: SessionboardEntity;
  created: number;
  updated: number;
  skipped: { row: number; reason: string }[];
  issues: { row: number; field: string; message: string }[];
}

export function SessionboardImportPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [entity, setEntity] = useState<SessionboardEntity>('contacts');
  const [csvText, setCsvText] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dryRunReport, setDryRunReport] = useState<ImportReport | null>(null);
  const [finalReport, setFinalReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (csvText.trim() === '') return null;
    try {
      return parseCsv(csvText);
    } catch (err) {
      return err instanceof Error ? err.message : 'Failed to parse the CSV export.';
    }
  }, [csvText]);

  const rows = typeof parsed === 'object' && parsed !== null ? parsed : null;
  const header = rows?.[0] ?? [];
  const dataRows = rows ? rows.slice(1) : [];
  const parseError = typeof parsed === 'string' ? parsed : null;

  const step = finalReport ? 3 : dryRunReport ? 3 : header.length > 0 ? 2 : 1;

  function resetForNewEntity(next: SessionboardEntity) {
    setEntity(next);
    setCsvText('');
    setMapping({});
    setDryRunReport(null);
    setFinalReport(null);
    setError(null);
  }

  function handleFile(file: File) {
    if (file.size > MAX_IMPORT_CSV_BYTES) {
      setError(
        `${file.name} is ${formatBytes(file.size)}, over the ${formatBytes(MAX_IMPORT_CSV_BYTES)} limit by ${formatBytes(file.size - MAX_IMPORT_CSV_BYTES)}.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''));
      setDryRunReport(null);
      setFinalReport(null);
      setError(null);
    };
    reader.readAsText(file);
  }

  function setColumnTarget(column: string, target: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (target === IGNORE_TARGET) {
        delete next[column];
      } else {
        next[column] = target;
      }
      return next;
    });
    setDryRunReport(null);
    setFinalReport(null);
  }

  function csvByteOverage(): string | null {
    const byteLength = new TextEncoder().encode(csvText).length;
    if (byteLength <= MAX_IMPORT_CSV_BYTES) return null;
    return `The pasted CSV is ${formatBytes(byteLength)}, over the ${formatBytes(MAX_IMPORT_CSV_BYTES)} limit by ${formatBytes(byteLength - MAX_IMPORT_CSV_BYTES)}.`;
  }

  async function runDryRun() {
    if (!eventId) return;
    const overage = csvByteOverage();
    if (overage) {
      setError(overage);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const report = await apiPost<ImportReport>(`/events/${eventId}/import/sessionboard`, {
        dryRun: true,
        entity,
        csvText,
        mapping,
      });
      setDryRunReport(report);
      setFinalReport(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Dry run failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!eventId) return;
    const overage = csvByteOverage();
    if (overage) {
      setError(overage);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const report = await apiPost<ImportReport>(`/events/${eventId}/import/sessionboard`, {
        dryRun: false,
        entity,
        csvText,
        mapping,
      });
      setFinalReport(report);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  // A mapping edit invalidates any report already on screen -- the report
  // is the planner's answer to a specific csvText+mapping; showing a stale
  // report after either changes would print numbers that no longer match
  // what a real import would do.
  useEffect(() => {
    setFinalReport(null);
  }, [entity]);

  const report = finalReport ?? dryRunReport;

  return (
    <section className="chq-settings-panel" aria-label="Import from Sessionboard">
      <div className="chq-settings-section-head">
        <h2>Import from Sessionboard</h2>
      </div>

      <p className="chq-settings-sessionboard-layer2-note">
        This build only supports importing your CSV/XLSX export from Sessionboard, below. Connecting a
        Sessionboard API token is not implemented in this build — the export is the supported import path.
      </p>
      <p className="chq-settings-sessionboard-order-note">
        Import in order: tracks, then contacts, then submissions, then participants — a participants dry run
        before its sessions exist will honestly report those rows as unresolved, not skip them silently.
      </p>
      <p className="chq-settings-sessionboard-visibility-note">
        Imported speakers are added hidden. Each one must be made visible individually, from the Visible
        checkbox on its submission&apos;s participants table, before it appears on the public site.
      </p>

      {eventLoading && <DelayedLoading />}
      {eventError && (
        <p role="alert" className="chq-error">
          {eventError}
        </p>
      )}
      {error && (
        <p role="alert" className="chq-error">
          {error}
        </p>
      )}

      {eventId && (
        <>
          <ol className="chq-steps" aria-label="Import CSV steps">
            <li className={`chq-step${step > 1 ? ' is-done' : step === 1 ? ' is-current' : ''}`}>
              Choose file
            </li>
            <li className={`chq-step${step > 2 ? ' is-done' : step === 2 ? ' is-current' : ''}`}>
              Match columns
            </li>
            <li className={`chq-step${step === 3 ? ' is-current' : ''}`}>Done</li>
          </ol>

          <fieldset className="chq-settings-row">
            <legend>What are you importing?</legend>
            <div className="chq-segmented" role="group" aria-label="Sessionboard entity">
              {ENTITIES.map((e) => (
                <button
                  key={e.entity}
                  type="button"
                  className={entity === e.entity ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
                  aria-pressed={entity === e.entity}
                  onClick={() => resetForNewEntity(e.entity)}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="chq-settings-sessionboard-size-hint">
            Up to {formatBytes(MAX_IMPORT_CSV_BYTES)} of CSV.
          </p>

          <div className="chq-settings-row">
            <label className="chq-settings-sessionboard-field">
              Upload the Sessionboard export (CSV)
              <input
                ref={fileInputRef}
                className="chq-file"
                type="file"
                accept=".csv,text/csv"
                aria-label="Upload the Sessionboard export"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
          </div>

          <div className="chq-settings-row">
            <label className="chq-settings-sessionboard-field">
              Or paste the exported CSV text
              <textarea
                className="chq-textarea"
                rows={6}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setDryRunReport(null);
                  setFinalReport(null);
                }}
                placeholder="name,email,company..."
              />
            </label>
          </div>

          {parseError && (
            <p role="alert" className="chq-error">
              {parseError}
            </p>
          )}

          {header.length > 0 && (
            <>
              <h3 className="chq-section-label">Match the columns</h3>
              <table className="chq-table chq-settings-sessionboard-mapping">
                <thead>
                  <tr>
                    <th className="chq-settings-sessionboard-mapping-col-column">Column</th>
                    <th className="chq-settings-sessionboard-mapping-col-sample">Sample value</th>
                    <th className="chq-settings-sessionboard-mapping-col-arrow"></th>
                    {/* No class hook: under table-layout:fixed this is the
                        SOLE unwidthed remainder column (DEC-902 wave-23) --
                        it holds the `.chq-segmented` pill group, the one
                        control that needs room to flex. */}
                    <th>Target field</th>
                  </tr>
                </thead>
                <tbody>
                  {header.map((col, colIndex) => {
                    const sample = dataRows[0]?.[colIndex] ?? '';
                    const current = mapping[col] ?? IGNORE_TARGET;
                    return (
                      <tr key={col}>
                        <td>{col}</td>
                        <td>{sample === '' ? <em>(blank)</em> : sample}</td>
                        <td aria-hidden="true">→</td>
                        <td>
                          <div className="chq-segmented" role="group" aria-label={`Map column ${col}`}>
                            <button
                              type="button"
                              className={current === IGNORE_TARGET ? 'chq-pill is-active' : 'chq-pill'}
                              aria-pressed={current === IGNORE_TARGET}
                              onClick={() => setColumnTarget(col, IGNORE_TARGET)}
                            >
                              Ignore
                            </button>
                            {TARGET_FIELDS[entity].map((field) => (
                              <button
                                key={field}
                                type="button"
                                className={current === field ? 'chq-pill is-active' : 'chq-pill'}
                                aria-pressed={current === field}
                                onClick={() => setColumnTarget(col, field)}
                              >
                                {field}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="chq-settings-row">
                <button type="button" className="chq-btn chq-btn-secondary" disabled={busy} onClick={() => void runDryRun()}>
                  {busy ? 'Checking…' : 'Preview import (dry run)'}
                </button>
              </div>
            </>
          )}

          {report && (
            <div className="chq-settings-sessionboard-report" aria-label="Import report">
              <h3 className="chq-section-label">
                {finalReport ? 'Import complete' : 'Dry run report'}
              </h3>
              <p>
                Created {report.created}, updated {report.updated}, skipped {report.skipped.length}.
              </p>
              {report.issues.length > 0 && (
                <>
                  <h4 className="chq-section-label">Issues</h4>
                  <ul className="chq-settings-sessionboard-issues">
                    {report.issues.map((issue, i) => (
                      <li key={i}>
                        Row {issue.row}, {issue.field}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {report.skipped.length > 0 && (
                <>
                  <h4 className="chq-section-label">Skipped rows</h4>
                  <ul className="chq-settings-sessionboard-skipped">
                    {report.skipped.map((s, i) => (
                      <li key={i}>
                        Row {s.row}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {dryRunReport && !finalReport && (
                <div className="chq-settings-row">
                  <button type="button" className="chq-btn chq-btn-primary" disabled={busy} onClick={() => void runImport()}>
                    {busy ? 'Importing…' : `Import ${dryRunReport.created + dryRunReport.updated} rows`}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
