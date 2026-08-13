// Duplicates (CRM, DEC-239). DEC-684: merge is a PAGE at its own URL
// (MergePage.tsx), not a modal — each group here is a link/button that
// navigates to /contacts/merge?ids=<contactIds> rather than opening a dialog.
// DEC-629: MergePage still posts /contacts/merge set-based — {keepId,
// mergeIds} — this view no longer owns any merge state or request.
// DEC-734: a duplicates list with only 'Merge' forces a wrong irreversible
// action -- 'Keep both' (dismiss the pair, session-only: this reader has no
// persisted dismissal store) and a pair counter are what make the tab
// workable. 'Not a duplicate' (MergePage's footer) lands back here the same
// way a merge notice does -- one-shot nav state, read once on mount.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiList, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import type { DuplicateGroup } from './types';
import './contacts-panels.css';

interface Props {
  onMerged: () => void;
  // DEC-684: after a merge, MergePage navigates back here with
  // { state: { panel: 'duplicates', notice: 'Contacts merged.' } } — this is
  // that notice's one-shot initial value, read by ContactsApp from
  // location.state and passed down. It is never re-derived after mount.
  initialNotice?: string | null;
  // DEC-734: MergePage's footer 'Not a duplicate' navigates back here with
  // { state: { panel: 'duplicates', notice: ..., dismissPairIds: [...] } } —
  // the pair to drop from THIS session's list, read once on mount exactly
  // like initialNotice.
  initialDismissPairIds?: string[] | null;
}

function pairKey(contactIds: string[]): string {
  return [...contactIds].sort().join(',');
}

export function DuplicatesView({ onMerged, initialNotice, initialDismissPairIds }: Props) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergedNotice] = useState<string | null>(initialNotice ?? null);
  // DEC-734: 'Keep both'/'Not a duplicate' dismiss a pair for this session
  // only -- findDuplicateGroupsForOrg has no persisted dismissal store, so a
  // reload of the Duplicates tab surfaces the pair again (still genuinely a
  // duplicate by the same detection rule).
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(initialDismissPairIds ? [pairKey(initialDismissPairIds)] : []));

  function reload() {
    setLoading(true);
    setError(null);
    apiList<DuplicateGroup>('/contacts/duplicates')
      .then((res) => setGroups(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load duplicates'))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  // DEC-684: a merge that lands here (from MergePage) always came from a
  // real change server-side — reload once so the merged group is gone from
  // the list, mirroring the old inline onMerged() call.
  useEffect(() => {
    if (initialNotice) onMerged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function keepBoth(group: DuplicateGroup) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(pairKey(group.contactIds));
      return next;
    });
  }

  const visibleGroups = groups.filter((g) => !dismissed.has(pairKey(g.contactIds)));

  return (
    <div className="chq-contacts-duplicates">
      <h2 className="chq-section-label">
        <span>Possible duplicates</span> <span className="chq-contacts-pipeline-caption">· {visibleGroups.length}</span>
      </h2>
      {error && <div className="chq-error">{error}</div>}
      {mergedNotice && (
        <div className="chq-error" role="status">
          {mergedNotice}
        </div>
      )}
      {loading && <DelayedLoading />}
      {!loading && visibleGroups.length === 0 && <p className="chq-empty">No duplicate groups found.</p>}

      <ul className="chq-contacts-duplicate-groups">
        {visibleGroups.map((g, i) => (
          <li key={i} className="chq-contacts-duplicate-group">
            <span className="chq-contacts-duplicate-names">
              {g.contacts
                .map((c) => `${c.firstName} ${c.lastName} <${c.email}>${c.company ? ` — ${c.company}` : ''}`)
                .join(' / ')}
            </span>
            <div className="chq-contacts-import-actions">
              <Link className="chq-btn chq-btn-primary" to={`/contacts/merge?ids=${g.contactIds.join(',')}`}>
                Merge
              </Link>
              <button type="button" className="chq-btn chq-btn-secondary" onClick={() => keepBoth(g)}>
                Keep both
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
