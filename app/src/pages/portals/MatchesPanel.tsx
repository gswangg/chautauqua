// Portal editor · the matches panel pinned beside the rule (Portals frame,
// flow 2, frames 03 and 04): who the rule as edited matches now, the first
// few of them, and how that differs from the saved rule. A rule that
// matches nobody gets the flagged panel instead -- allowed, and it starts
// working once someone matches.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MatchRow } from './types';

const FIRST_ROWS = 5;

export interface MatchesPanelProps {
  count: number;
  rows: MatchRow[];
  // the saved rule's live count, and the edit's difference from it
  savedCount: number;
  gained: number;
  lost: number;
  ruleChanged: boolean;
  pending: boolean;
  error: string | null;
  incomplete: boolean;
  nobodyLine: string;
}

export function MatchesPanel({ count, rows, savedCount, gained, lost, ruleChanged, pending, error, incomplete, nobodyLine }: MatchesPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, FIRST_ROWS);

  if (count === 0 && !error) {
    return (
      <aside className="chq-portal-matches chq-portal-matches-nobody" aria-label="Matches" aria-busy={pending}>
        <span className="chq-portal-matches-label">Matches nobody</span>
        <span className="chq-portal-matches-count">0</span>
        <p className="chq-portal-matches-line">{nobodyLine}</p>
        <p className="chq-portal-matches-note">It starts working when someone does.</p>
        {ruleChanged && savedCount > 0 ? (
          <p className="chq-portal-matches-diff">
            {savedCount} saved · −{lost}
          </p>
        ) : null}
        {incomplete ? <p className="chq-portal-matches-note">Unfinished conditions aren't counted yet.</p> : null}
      </aside>
    );
  }

  return (
    <aside className="chq-portal-matches" aria-label="Matches" aria-busy={pending}>
      <div className="chq-portal-matches-head">
        <span className="chq-portal-matches-label">Matches now</span>
        <span className="chq-portal-matches-count">{count}</span>
      </div>
      {error ? (
        <p className="chq-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="chq-portal-matches-list" data-expanded={showAll ? 'true' : undefined}>
        {shown.map((row) => (
          <li key={row.key} className="chq-portal-matches-row">
            <Link className="chq-portal-matches-name" to={`/contacts/${row.contactId}`}>
              {row.name}
            </Link>
            <span className="chq-portal-matches-sub">{row.participation}</span>
          </li>
        ))}
      </ul>
      {rows.length > FIRST_ROWS ? (
        <button type="button" className="chq-link-button chq-portal-matches-all" aria-expanded={showAll} onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show the first five' : `All ${count} ›`}
        </button>
      ) : null}
      {showAll && rows.length < count ? <p className="chq-portal-matches-note">Showing the first {rows.length}.</p> : null}
      {incomplete ? <p className="chq-portal-matches-note">Unfinished conditions aren't counted yet.</p> : null}
      <p className="chq-portal-matches-diff">
        {ruleChanged ? (
          <strong>
            {savedCount} saved · +{gained} · −{lost}
          </strong>
        ) : (
          'Same as the saved rule'
        )}
      </p>
    </aside>
  );
}
