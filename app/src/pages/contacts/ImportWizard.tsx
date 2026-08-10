import { useMemo, useState } from 'react';
import { apiPost, ApiError } from '../../lib/api';
import { mapImportRow, parseCsv, STANDARD_IMPORT_FIELDS } from './csv';
import type { ImportResult } from './types';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const PREVIEW_ROWS = 5;

export function ImportWizard({ onClose, onImported }: Props) {
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

  const previewRows = dataRows.slice(0, PREVIEW_ROWS);
  const previewMapped = previewRows.map((row) => mapImportRow(mapping, header, row));

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<ImportResult>('/contacts/import', { csvText, mapping });
      setResult(res);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chq-modal-backdrop" role="dialog" aria-label="Import contacts">
      <div className="chq-modal chq-import-wizard">
        <button type="button" className="chq-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Import contacts from CSV</h2>

        {error && <div className="chq-error-banner">{error}</div>}

        {!result && (
          <>
            <label>
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
            <label>
              Or paste CSV text
              <textarea rows={8} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="firstName,lastName,email..." />
            </label>

            {parseError && <div className="chq-error-banner">{parseError}</div>}

            {header.length > 0 && (
              <>
                <h3>Column mapping</h3>
                <table className="chq-mapping-table">
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
                            <option value={`custom.${col}`}>custom: {col}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3>Preview (first {PREVIEW_ROWS} rows)</h3>
                <table className="chq-preview-table">
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
                        <td>{row.email ?? <em>skip — no email</em>}</td>
                        <td>{row.firstName ?? '—'}</td>
                        <td>{row.lastName ?? '—'}</td>
                        <td>{row.company ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p>{dataRows.length} data row(s) total.</p>
                <button type="button" disabled={busy} onClick={runImport}>
                  Import {dataRows.length} row(s)
                </button>
              </>
            )}
          </>
        )}

        {result && (
          <div className="chq-import-result">
            <h3>Import complete</h3>
            <p>
              Created {result.created}, updated {result.updated}, skipped {result.skipped.length}.
            </p>
            {result.skipped.length > 0 && (
              <ul>
                {result.skipped.map((s) => (
                  <li key={s.line}>
                    Line {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
