import type { ContactStats } from './types';

export function StatsStrip({ stats }: { stats: ContactStats | null }) {
  if (!stats) return null;
  return (
    <div className="chq-contacts-stats-strip">
      <div className="chq-stat">
        <span className="chq-stat-value">{stats.total}</span>
        <span className="chq-stat-label">Total contacts</span>
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
              {c.company} ({c.count})
            </li>
          ))}
          {stats.topCompanies.length === 0 && <li>—</li>}
        </ul>
      </div>
    </div>
  );
}
