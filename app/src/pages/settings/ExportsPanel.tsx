// DEC-032 Settings panel: per-entity CSV/JSON export download links (J12,
// DEC-027) for the current event. Plain anchor tags — the browser handles
// the attachment download; cookie session auth covers these GETs (no
// x-chq-csrf needed for GET requests per DEC-004).
//
// w1-f, DEC-785: this panel is only ever mounted inside its caller's own
// edit drill (YourDataPanel's "More export formats" disclosure), so at rest
// it must not ALSO dump straight into the full download table -- it owns
// its own local summary/edit split. At rest it lists the available formats
// by name; 'Change' switches to the download-link table below.
import { useState } from 'react';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { DelayedLoading } from '../../components/DelayedLoading';
import './settings-lists.css';

const EXPORT_KINDS: { kind: string; label: string }[] = [
  { kind: 'submissions', label: 'Submissions' },
  { kind: 'speakers', label: 'Speakers' },
  { kind: 'evaluations', label: 'Evaluations' },
  { kind: 'agenda', label: 'Agenda' },
  { kind: 'email-log', label: 'Email log' },
  { kind: 'contacts', label: 'Contacts' },
];

const AVAILABLE_FORMATS = [...EXPORT_KINDS.map((k) => k.label), 'Show-flow (CSV only)'];

export function ExportsPanel() {
  const { eventId, loading, error } = useCurrentEvent();
  const [showEditor, setShowEditor] = useState(false);

  if (!showEditor) {
    return (
      <section className="chq-settings-panel" aria-label="Exports">
        <h2>Exports</h2>
        {loading && <DelayedLoading />}
        {error && <div className="chq-error" role="alert">{error}</div>}
        <ul className="chq-settings-summary-list">
          {AVAILABLE_FORMATS.map((label) => (
            <li key={label} className="chq-settings-summary-row">
              <span className="chq-settings-summary-row-primary">{label}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="chq-link-button" onClick={() => setShowEditor(true)}>
          Change
        </button>
      </section>
    );
  }

  return (
    <section className="chq-settings-panel" aria-label="Exports">
      <h2>Exports</h2>
      <p>Download event data as CSV or JSON.</p>

      <button type="button" className="chq-link-button" onClick={() => setShowEditor(false)}>
        Back
      </button>

      {loading && <DelayedLoading />}
      {error && <div className="chq-error" role="alert">{error}</div>}

      {eventId && (
        <table className="chq-table chq-settings-exports-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>CSV</th>
              <th>JSON</th>
            </tr>
          </thead>
          <tbody>
            {EXPORT_KINDS.map(({ kind, label }) => (
              <tr key={kind}>
                <td>{label}</td>
                <td>
                  <a href={`/api/v1/events/${eventId}/export/${kind}?format=csv`}>Download CSV</a>
                </td>
                <td>
                  <a href={`/api/v1/events/${eventId}/export/${kind}?format=json`}>Download JSON</a>
                </td>
              </tr>
            ))}
            <tr>
              <td>Show-flow (CSV)</td>
              <td>
                <a href={`/api/v1/events/${eventId}/exports/showflow.csv`}>Download CSV</a>
              </td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
