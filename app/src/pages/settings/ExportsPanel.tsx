// DEC-032 Settings panel: per-entity CSV/JSON export download links (J12,
// DEC-027) for the current event. Plain anchor tags — the browser handles
// the attachment download; cookie session auth covers these GETs (no
// x-chq-csrf needed for GET requests per DEC-004).
//
// DEC-032 amendment (wave 20, B10): exports are actions, not settings --
// DESIGN-RULINGS.md B10 forbids gating a download table behind a local
// 'Change' button; the read row already carries every value AND every
// action, so a 'Change' gate that only exposed the SAME table underneath
// was a gate over nothing (the same shape DEC-896 already ruled on for
// PublicPagesPanel/SavedEmbedsPanel). The download table renders
// unconditionally now; this panel is only ever mounted inside its
// caller's own edit drill (YourDataPanel's "More export formats"
// disclosure) so there is no section-level read/edit split to preserve
// here either way. Deliberately does NOT build the frame's 'Keeping and
// deleting' retention block (docs/design/Chautauqua Settings.dc.html:
// 1161-1180) -- no column, no endpoint, no rubric backs it; recorded as a
// deliberate non-build on DEC-032.
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

export function ExportsPanel() {
  const { eventId, loading, error } = useCurrentEvent();

  return (
    <section className="chq-settings-panel" aria-label="Exports">
      <h2>Exports</h2>
      <p className="chq-settings-markdown-hint">
        Exports are actions, not settings — they download at once and there is nothing here to save.
      </p>

      {loading && <DelayedLoading />}
      {error && <div className="chq-error" role="alert">{error}</div>}

      {eventId && (
        <table className="chq-table chq-settings-exports-table">
          <thead>
            <tr>
              {/* No class hook: under table-layout:fixed this is the SOLE
                  unwidthed remainder column (DEC-902 wave-23), so it needs no
                  width rule -- and a className with no CSS rule behind it is
                  exactly what DEC-976/DEC-379 forbid. */}
              <th>Data</th>
              <th className="chq-settings-exports-col-csv">CSV</th>
              <th className="chq-settings-exports-col-json">JSON</th>
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
