import type { ContactStats } from './types';

interface Props {
  stats: ContactStats | null;
  /** Invoked with a company name when a top-companies row is clicked; the
   * parent (ContactsApp) applies a {field:'company',op:'eq'} filter rule
   * (DEC-149). */
  onCompanyClick?: (company: string) => void;
}

/** CRM-12 dashboard panel: KPI counters + a clickable top-companies
 * widget (data from GET /contacts/stats). */
export function StatsStrip({ stats, onCompanyClick }: Props) {
  if (!stats) return null;
  return (
    <div className="chq-contacts-stats-strip">
      <div className="chq-stat">
        <span className="chq-stat-value">{stats.total}</span>
        <span className="chq-stat-label">Total contacts</span>
      </div>
      <div className="chq-stat">
        <span className="chq-stat-value">{stats.eventCount}</span>
        <span className="chq-stat-label">Events</span>
      </div>
      <div className="chq-stat">
        <span className="chq-stat-value">{stats.returningSpeakers}</span>
        <span className="chq-stat-label">Returning speakers</span>
      </div>
      <div className="chq-stat chq-stat-top-companies">
        <span className="chq-stat-label">Top companies</span>
        <ul>
          {stats.topCompanies.map((c) => (
            <li key={c.company}>
              {onCompanyClick ? (
                <button type="button" className="chq-link-button" onClick={() => onCompanyClick(c.company)}>
                  {c.company} ({c.count})
                </button>
              ) : (
                <>
                  {c.company} ({c.count})
                </>
              )}
            </li>
          ))}
          {stats.topCompanies.length === 0 && <li>—</li>}
        </ul>
      </div>
    </div>
  );
}
