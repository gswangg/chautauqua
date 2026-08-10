// DEC-032 Settings panel: per-entity CSV/JSON export download links (J12,
// DEC-027) for the current event. Plain anchor tags — the browser handles
// the attachment download; cookie session auth covers these GETs (no
// x-chq-csrf needed for GET requests per DEC-004).
import { useCurrentEvent } from '../../lib/useCurrentEvent';

const EXPORT_KINDS: { kind: string; label: string }[] = [
  { kind: 'submissions', label: 'Submissions' },
  { kind: 'speakers', label: 'Speakers' },
  { kind: 'evaluations', label: 'Evaluations' },
  { kind: 'agenda', label: 'Agenda' },
  { kind: 'email-log', label: 'Email log' },
];

export function ExportsPanel() {
  const { eventId, loading, error } = useCurrentEvent();

  return (
    <section className="chq-panel" aria-label="Exports">
      <h2>Exports</h2>
      <p>Download event data as CSV or JSON.</p>

      {loading && <p>Loading…</p>}
      {error && <div className="chq-error" role="alert">{error}</div>}

      {eventId && (
        <table>
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
