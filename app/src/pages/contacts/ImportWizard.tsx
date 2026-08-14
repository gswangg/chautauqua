import { useEffect, useMemo, useRef, useState } from 'react';
import { apiPost, ApiError } from '../../lib/api';
import { expandFullNameMapping, mapImportRow, parseCsv, suggestMapping, toCsv, FULL_NAME_TARGET, STANDARD_IMPORT_FIELDS } from './csv';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import type { ImportPlan, ImportPlanRow, ImportResult } from './types';
import { DEC_810 } from '../../../../src/decisions';
import { countOf } from '../../lib/plural';
import './contacts-panels.css';

// Compile-checked dependency marker: when `eventId` is set, this wizard
// collects a required `sessionTitle` for the batch (in the same step the
// event is already chosen) rather than letting the server invent an
// 'Invited: <name>' title per contact (DEC-810).
void DEC_810;

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
//
// DEC-663: the flow now runs a dry-run POST (dryRun: true) before ever
// committing. The dry run's rows -- and the exact {csvText, mapping,
// eventId?} body that produced them -- are shown to the organizer on a
// Review step; the commit POST reuses that exact body plus `skipLines`
// (the checked "skip this row" boxes), never a body reconstructed from
// possibly-since-edited mapping state.

const PREVIEW_ROWS = 5;

interface PlannedRequest {
  csvText: string;
  mapping: Record<string, string>;
  eventId?: string;
  sessionTitle?: string;
}

function actionLabel(row: ImportPlanRow): string {
  if (row.action === 'create') return 'Create';
  if (row.action === 'update') return 'Update';
  return `Skip — ${row.reason ?? 'no reason given'}`;
}

export function ImportWizard({ onClose, onImported, eventId }: Props) {
  const [csvText, setCsvText] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  // DEC-810: when this import is scoped to an event, the whole batch shares
  // one session title -- collected here, in the step where the event is
  // already chosen (the eventId prop), never invented server-side.
  const [sessionTitle, setSessionTitle] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [plannedRequest, setPlannedRequest] = useState<PlannedRequest | null>(null);
  const [skipLines, setSkipLines] = useState<Set<number>>(new Set());
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

  // Step strip (mock "Import CSV · step 3 of 4"): 1 = choose a file, 2 =
  // map columns, 3 = review the dry run, 4 = done. Display-only -- does
  // not gate the real flow, which stays driven by
  // csvText/header/plan/result exactly as before.
  const step = result ? 4 : plan ? 3 : header.length > 0 ? 2 : 1;

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  async function runPreview() {
    if (eventId && sessionTitle.trim() === '') {
      setError('Enter a session title for this batch.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Split any full-name-mapped column into first/last before the
      // server ever sees it (see expandFullNameMapping in ./csv.ts).
      const expanded = expandFullNameMapping(header, dataRows, mapping);
      const expandedCsvText = toCsv([expanded.header, ...expanded.rows]);
      const request: PlannedRequest = {
        csvText: expandedCsvText,
        mapping: expanded.mapping,
        ...(eventId ? { eventId, sessionTitle: sessionTitle.trim() } : {}),
      };
      const res = await apiPost<ImportPlan>('/contacts/import', { ...request, dryRun: true });
      setPlan(res);
      setPlannedRequest(request);
      setSkipLines(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  function toggleSkipLine(line: number) {
    setSkipLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return next;
    });
  }

  async function runCommit() {
    if (!plannedRequest) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<ImportResult>('/contacts/import', {
        ...plannedRequest,
        skipLines: [...skipLines],
      });
      setResult(res);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  const actions = result ? (
    <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
      Done
    </button>
  ) : plan ? (
    <>
      <button type="button" className="chq-btn chq-btn-primary" disabled={busy} onClick={runCommit}>
        Import {countOf(plan.rows.length - skipLines.size, 'row')}
      </button>
      <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
        Cancel
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        className="chq-btn chq-btn-primary"
        disabled={busy || dataRows.length === 0 || (!!eventId && sessionTitle.trim() === '')}
        onClick={runPreview}
      >
        Preview {countOf(dataRows.length, 'row')}
      </button>
      <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
        Cancel
      </button>
      {/* w40-h: names the blocker on the disabled primary instead of leaving
          an unexplained disabled button -- disappears the moment the field
          that unblocks it is filled. */}
      {!!eventId && sessionTitle.trim() === '' && (
        <span className="chq-contacts-import-blocker">Add a session title for this batch to preview</span>
      )}
    </>
  );

  return (
    <ModalFrame
      title="Import contacts from CSV"
      ariaLabel="Import contacts"
      onClose={onClose}
      closeDisabled={busy}
      modalClassName="chq-contacts-import"
      actions={actions}
    >
      <ol className="chq-steps" aria-label="Import steps">
        <li className={`chq-step${step > 1 ? ' is-done' : step === 1 ? ' is-current' : ''}`}>Choose file</li>
        <li className={`chq-step${step > 2 ? ' is-done' : step === 2 ? ' is-current' : ''}`}>Match columns</li>
        <li className={`chq-step${step > 3 ? ' is-done' : step === 3 ? ' is-current' : ''}`}>Review</li>
        <li className={`chq-step${step === 4 ? ' is-current' : ''}`}>Done</li>
      </ol>

      {error && <div className="chq-error">{error}</div>}

      {!plan && !result && (
        <div className="chq-contacts-import-drop">
          <FormRow label="Upload a CSV file" htmlFor="import-csv-file">
            <input
              id="import-csv-file"
              className="chq-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              placeholder="contacts.csv"
            />
          </FormRow>
          <FormRow label="Or paste CSV text" htmlFor="import-csv-text">
            <textarea
              id="import-csv-text"
              className="chq-textarea"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="firstName,lastName,email..."
            />
          </FormRow>

          {parseError && <div className="chq-error">{parseError}</div>}

          {eventId && (
            <FormRow
              label="Session title for this batch"
              htmlFor="import-session-title"
              help="Every contact added to this event by this import joins ONE accepted session with this title."
            >
              <input
                id="import-session-title"
                className="chq-input"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g. Lightning talks"
                required
              />
            </FormRow>
          )}

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
              <table className="chq-table chq-contacts-import-preview">
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
                      <td>{row.email ?? <em className="chq-contacts-import-preview-cell-skip">skip — no email</em>}</td>
                      <td>{row.firstName ?? '—'}</td>
                      <td>{row.lastName ?? '—'}</td>
                      <td>{row.company ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="chq-contacts-pipeline-caption">{countOf(dataRows.length, 'data row')} total.</p>
            </>
          )}
        </div>
      )}

      {plan && !result && (
        <div className="chq-contacts-import-review">
          <h3 className="chq-section-label">Review before import</h3>
          <table className="chq-table chq-contacts-import-review-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Email</th>
                <th>Action</th>
                <th>Skip this row</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => {
                const updateReason = row.action === 'update' ? row.reason : undefined;
                const decorated =
                  (row.overwrites?.length ?? 0) > 0 || (row.possibleDuplicates?.length ?? 0) > 0 || Boolean(updateReason);
                return (
                  <tr key={row.line}>
                    <td>{row.line}</td>
                    <td>{row.email}</td>
                    <td>
                      {actionLabel(row)}
                      {decorated && (
                        <ul className="chq-contacts-import-review-detail">
                          {updateReason && <li>{updateReason}</li>}
                          {(row.overwrites ?? []).map((ow, i) => (
                            <li key={`ow-${i}`}>
                              {ow.field}: "{ow.from}" → "{ow.to}"
                            </li>
                          ))}
                          {(row.possibleDuplicates ?? []).map((dup) => (
                            <li key={`dup-${dup.contactId}`}>
                              May be a duplicate of {dup.name} ({dup.email}) — a different email address.
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      <label className="chq-contacts-import-review-skip">
                        <input
                          className="chq-check"
                          type="checkbox"
                          checked={skipLines.has(row.line)}
                          onChange={() => toggleSkipLine(row.line)}
                          aria-label={`Skip line ${row.line}`}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="chq-contacts-pipeline-caption">{countOf(skipLines.size, 'row')} marked to skip.</p>
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
        </div>
      )}
    </ModalFrame>
  );
}
