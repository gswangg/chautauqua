import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { apiPost, ApiError } from '../../lib/api';
import { expandFullNameMapping, mapImportRow, parseCsv, suggestMapping, toCsv, FULL_NAME_TARGET, STANDARD_IMPORT_FIELDS } from './csv';
import { useEscapeKey } from '../../lib/useEscapeKey';
import type { ImportResult } from './types';
import './contacts-panels.css';

interface Props {
  onClose: () => void;
  onImported: () => void;
  // DEC-290: when set (e.g. the Speakers roster importer), the import is
  // additionally scoped to this event -- the server pushes every imported
  // contact onto the event's roster and reports `addedToEvent` back. Absent
  // this prop, behavior is unchanged from the CRM-only import (today's
  // ContactsApp call site).
  eventId?: string;
}

// Behaviour frozen (DEC-366): CSV column mapping and the set-based import
// call are untouched by this redesign (w2-e) -- restyled with the shared
// .chq-steps strip (mock "Import CSV · step 2 of 3") plus .chq-contacts-
// import-* layout classes.

const PREVIEW_ROWS = 5;

export function ImportWizard({ onClose, onImported, eventId }: Props) {
  const [csvText, setCsvText] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (csvText.trim() === '') return null;
    try {
      return parseCsv(csvText);
    } catch (err) {
      return err instanceof Error ? err.message : 'Failed to parse CSV';
    }
  }, [csvText]);

  const rows = typeof parsed === 'object' && parsed !== null ? parsed : null;
  const header = rows?.[0] ?? [];
  const dataRows = rows ? rows.slice(1) : [];
  const parseError = typeof parsed === 'string' ? parsed : null;

  // P1 fix (w1-f): auto-suggest a mapping from header names on the first
  // sight of a given header (see suggestMapping in ./csv.ts), so a CSV whose
  // columns already read "Email"/"First Name"/etc. imports without the user
  // having to hand-map every column first. Re-suggests once per distinct
  // header (by content, not header identity), and never overwrites a
  // mapping the user has already started editing for that header.
  const lastAutoMappedHeader = useRef<string | null>(null);
  useEffect(() => {
    if (header.length === 0) return;
    const signature = header.join('\u0000');
    if (lastAutoMappedHeader.current === signature) return;
    lastAutoMappedHeader.current = signature;
    const suggested = suggestMapping(header);
    if (Object.keys(suggested).length > 0) setMapping(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.join('\u0000')]);

  const previewRows = dataRows.slice(0, PREVIEW_ROWS);
  const previewMapped = previewRows.map((row) => mapImportRow(mapping, header, row));

  // Step strip (mock "Import CSV · step 2 of 3"): 1 = choose a file, 2 =
  // map columns, 3 = done. Display-only -- does not gate the real flow,
  // which stays driven by csvText/header/result exactly as before.
  const step = result ? 3 : header.length > 0 ? 2 : 1;

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      // Split any full-name-mapped column into first/last before the
      // server ever sees it (see expandFullNameMapping in ./csv.ts).
      const expanded = expandFullNameMapping(header, dataRows, mapping);
      const expandedCsvText = toCsv([expanded.header, ...expanded.rows]);
      const res = await apiPost<ImportResult>('/contacts/import', {
        csvText: expandedCsvText,
        mapping: expanded.mapping,
        ...(eventId ? { eventId } : {}),
      });
      setResult(res);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  useEscapeKey(true, () => {
    if (!busy) onClose();
  });

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !busy) onClose();
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Import contacts" onClick={handleScrimClick}>
      <div className="chq-modal chq-contacts-import">
        <button type="button" className="chq-btn-tertiary" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="chq-page-title">Import contacts from CSV</h2>

        <ol className="chq-steps" aria-label="Import steps">
          <li className={`chq-step${step > 1 ? ' is-done' : step === 1 ? ' is-current' : ''}`}>Choose file</li>
          <li className={`chq-step${step > 2 ? ' is-done' : step === 2 ? ' is-current' : ''}`}>Match columns</li>
          <li className={`chq-step${step === 3 ? ' is-current' : ''}`}>Done</li>
        </ol>

        {error && <div className="chq-error">{error}</div>}

        {!result && (
          <div className="chq-contacts-import-drop">
            <label className="chq-contacts-import-field">
              Upload a CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
            <label className="chq-contacts-import-field">
              Or paste CSV text
              <textarea
                className="chq-textarea"
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="firstName,lastName,email..."
              />
            </label>

            {parseError && <div className="chq-error">{parseError}</div>}

            {header.length > 0 && (
              <>
                <h3 className="chq-section-label">Column mapping</h3>
                <table className="chq-table chq-contacts-import-mapping">
                  <thead>
                    <tr>
                      <th>CSV column</th>
                      <th>Maps to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {header.map((col) => (
                      <tr key={col}>
                        <td>{col}</td>
                        <td>
                          <select
                            className="chq-select"
                            aria-label={`Map column ${col}`}
                            value={mapping[col] ?? ''}
                            onChange={(e) =>
                              setMapping((prev) => {
                                const next = { ...prev };
                                if (e.target.value === '') {
                                  delete next[col];
                                } else {
                                  next[col] = e.target.value;
                                }
                                return next;
                              })
                            }
                          >
                            <option value="">(ignore)</option>
                            {STANDARD_IMPORT_FIELDS.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                            <option value={FULL_NAME_TARGET}>Full name (splits into first / last)</option>
                            <option value={`custom.${col}`}>custom: {col}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 className="chq-section-label">Preview (first {PREVIEW_ROWS} rows)</h3>
                <table className="chq-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>First</th>
                      <th>Last</th>
                      <th>Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewMapped.map((row, i) => (
                      <tr key={i}>
                        <td>
                          {row.email ?? <em className="chq-contacts-import-preview-cell-skip">skip — no email</em>}
                        </td>
                        <td>{row.firstName ?? '—'}</td>
                        <td>{row.lastName ?? '—'}</td>
                        <td>{row.company ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="chq-contacts-import-actions">
                  <button type="button" className="chq-btn chq-btn-primary" disabled={busy} onClick={runImport}>
                    Import {dataRows.length} row(s)
                  </button>
                  <span className="chq-contacts-pipeline-caption">{dataRows.length} data row(s) total.</span>
                </div>
              </>
            )}
          </div>
        )}

        {result && (
          <div className="chq-contacts-import-summary">
            <h3 className="chq-section-label">Import complete</h3>
            <p>
              Created {result.created}, updated {result.updated}, skipped {result.skipped.length}.
            </p>
            {eventId && <p>Added {result.addedToEvent ?? 0} to this event.</p>}
            {result.skipped.length > 0 && (
              <ul className="chq-contacts-import-skipped">
                {result.skipped.map((s) => (
                  <li key={s.line}>
                    Line {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            )}
            <div>
              <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
