// Duplicates (CRM, DEC-239). DEC-684: merge is a PAGE at its own URL
// (MergePage.tsx), not a modal — each group here is a link/button that
// navigates to /contacts/merge?ids=<contactIds> rather than opening a dialog.
// DEC-629: MergePage still posts /contacts/merge set-based — {keepId,
// mergeIds} — this view no longer owns any merge state or request.
// DEC-734: a duplicates list with only 'Merge' forces a wrong irreversible
// action -- 'Keep both' (dismiss the pair) and a pair counter are what make
// the tab workable. 'Not a duplicate' (MergePage's footer) lands back here
// the same way a merge notice does -- one-shot nav state, read once on
// mount. DEC-770: both controls persist the dismissal server-side
// (POST /contacts/duplicates/dismiss) -- it is a fact about the pair, not a
// session mood, so it survives reload.
// DEC-711 amendment (wave 40): the tab's own count must match the server's
// TRUE total (the header above it already reads GET /contacts/stats'
// duplicateCount over the whole org) and every group past row 200 must stay
// reachable -- an explicit `?perPage=MAX_PER_PAGE` request plus a DEC-845-
// style "Showing X of N / Show all N" affordance that pages the remainder
// in, mirroring ReviewerQueue.tsx's loadAllPages.
import { useEffect, useState } from 'react';
import { apiList, apiPost, ApiError } from '../../lib/api';
import type { ListEnvelope } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { DuplicateRow } from './DuplicateRow';
import type { DuplicateGroup } from './types';
import { MAX_PER_PAGE, MAX_PAGE } from '../../../../src/lib/pagination';
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
  // DEC-711 amendment (wave 40): the envelope's own TRUE total (never
  // groups.length, which is only whatever page(s) have been loaded) --
  // this is what the header count and "Showing X of N" line both read.
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(MAX_PER_PAGE);
  const [showAll, setShowAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergedNotice] = useState<string | null>(initialNotice ?? null);
  // DEC-770: 'Keep both'/'Not a duplicate' persist the dismissal
  // server-side (POST /contacts/duplicates/dismiss) -- findDuplicateGroupsForOrg
  // excludes it from then on, so a reload of the Duplicates tab does not
  // surface the pair again. This local set is only an optimistic mirror of
  // that server state so the row disappears immediately, without a reload.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(initialDismissPairIds ? [pairKey(initialDismissPairIds)] : []));
  const [dismissError, setDismissError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    setShowAll(false);
    // DEC-711 amendment (wave 40): always request the site-wide page cap --
    // a duplicates org above 200 groups must still get page 1's worth,
    // never apiList's 50-row default, and the envelope's own total/perPage
    // (never a hand-typed 200) drive the "Show all N" affordance below.
    apiList<DuplicateGroup>(`/contacts/duplicates?perPage=${MAX_PER_PAGE}`)
      .then((res) => {
        setGroups(res.items);
        setTotal(res.total);
        setPerPage(res.perPage);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load duplicates'))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  // DEC-711 amendment (wave 40)/DEC-845: "Show all N" loads pages 2..
  // ceil(total/perPage) sequentially and appends each page's groups before
  // flipping showAll -- stops early on a zero-row page (belt-and-suspenders
  // against a total that raced stale) and never walks past clampPage's own
  // MAX_PAGE ceiling, mirroring ReviewerQueue.tsx's loadAllPages.
  async function loadAllPages() {
    setLoadingMore(true);
    setError(null);
    try {
      const lastPage = Math.min(Math.ceil(total / perPage), MAX_PAGE);
      let appended: DuplicateGroup[] = [];
      for (let page = 2; page <= lastPage; page += 1) {
        const res: ListEnvelope<DuplicateGroup> = await apiList<DuplicateGroup>(
          `/contacts/duplicates?perPage=${perPage}&page=${page}`,
        );
        if (res.items.length === 0) break;
        appended = appended.concat(res.items);
      }
      setGroups((prev) => prev.concat(appended));
      setShowAll(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the rest of the duplicates list');
    } finally {
      setLoadingMore(false);
    }
  }

  // DEC-684: a merge that lands here (from MergePage) always came from a
  // real change server-side — reload once so the merged group is gone from
  // the list, mirroring the old inline onMerged() call.
  useEffect(() => {
    if (initialNotice) onMerged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function keepBoth(group: DuplicateGroup) {
    const key = pairKey(group.contactIds);
    setDismissError(null);
    // Optimistic: remove the row immediately, then persist. A failed
    // persist rolls the row back loudly rather than leaving the UI showing
    // a dismissal the server never recorded.
    setDismissed((prev) => new Set(prev).add(key));
    apiPost('/contacts/duplicates/dismiss', { contactIds: group.contactIds }).catch((err) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setDismissError(err instanceof ApiError ? err.message : 'Failed to dismiss pair');
    });
  }

  const visibleGroups = groups.filter((g) => !dismissed.has(pairKey(g.contactIds)));
  // DEC-711 amendment (wave 40): the stated count is the envelope's TRUE
  // total minus this session's own dismissals -- each dismissal removes
  // exactly one real group server-side (DEC-770), so subtracting it keeps
  // the number honest without a refetch, and it stays true past row 200
  // (unlike visibleGroups.length, which is only whatever pages are loaded).
  const statedTotal = total - dismissed.size;

  return (
    <div className="chq-contacts-duplicates">
      <h2 className="chq-section-label">
        <span>Possible duplicates</span> <span className="chq-contacts-pipeline-caption">· {statedTotal}</span>
      </h2>
      {/* DEC-143/DEC-748: the matching rule stated plainly so a same-name,
          different-company non-match doesn't read as a bug. */}
      <p className="chq-contacts-duplicates-rule">
        Matched on the same email, the same name at the same company, or the same name at a different company.
      </p>
      {error && <div className="chq-error">{error}</div>}
      {dismissError && <div className="chq-error">{dismissError}</div>}
      {mergedNotice && (
        <div className="chq-error" role="status">
          {mergedNotice}
        </div>
      )}
      {loading && <DelayedLoading />}
      {!loading && visibleGroups.length === 0 && <p className="chq-empty">No duplicate groups found.</p>}

      <ul className="chq-contacts-duplicate-groups">
        {visibleGroups.map((g, i) => (
          <DuplicateRow key={i} group={g} onKeepBoth={keepBoth} />
        ))}
      </ul>

      {/* DEC-711 amendment (wave 40)/DEC-845: past 200 groups the loaded
          page and the stated total disagree unless every group is reachable
          -- this states what is loaded, and "Show all N" pages the
          remainder in rather than leaving groups 201+ unreachable. */}
      {!loading && !showAll && total > perPage && (
        <div className="chq-contacts-duplicates-footer">
          <span className="chq-contacts-pipeline-caption">{`Showing ${visibleGroups.length} of ${statedTotal}`}</span>
          <button
            type="button"
            className="chq-link-button"
            disabled={loadingMore}
            onClick={() => void loadAllPages()}
          >
            {`Show all ${statedTotal}`}
          </button>
        </div>
      )}
    </div>
  );
}
