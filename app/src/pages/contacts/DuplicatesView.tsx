// Duplicates (CRM, DEC-239). DEC-684: merge is a PAGE at its own URL
// (MergePage.tsx), not a modal — each group here is a link/button that
// navigates to /contacts/merge?ids=<contactIds> rather than opening a dialog.
// DEC-629: MergePage still posts /contacts/merge set-based — {keepId,
// mergeIds} — this view no longer owns any merge state or request.
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
}

export function DuplicatesView({ onMerged, initialNotice }: Props) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergedNotice] = useState<string | null>(initialNotice ?? null);

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

  return (
    <div className="chq-contacts-duplicates">
      <h2 className="chq-section-label">
        <span>Possible duplicates</span> <span className="chq-contacts-pipeline-caption">· {groups.length}</span>
      </h2>
      {error && <div className="chq-error">{error}</div>}
      {mergedNotice && (
        <div className="chq-error" role="status">
          {mergedNotice}
        </div>
      )}
      {loading && <DelayedLoading />}
      {!loading && groups.length === 0 && <p className="chq-empty">No duplicate groups found.</p>}

      <ul className="chq-contacts-duplicate-groups">
        {groups.map((g, i) => (
          <li key={i} className="chq-contacts-duplicate-group">
            <span className="chq-contacts-duplicate-names">
              {g.contacts.map((c) => `${c.firstName} ${c.lastName} <${c.email}>`).join(' / ')}
            </span>
            <div className="chq-contacts-import-actions">
              <Link className="chq-btn chq-btn-primary" to={`/contacts/merge?ids=${g.contactIds.join(',')}`}>
                Merge
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
