import { useEffect, useState } from 'react';
import { apiList, apiPost, ApiError } from '../../lib/api';
import type { DuplicateGroup } from './types';

interface Props {
  onMerged: () => void;
}

export function DuplicatesView({ onMerged }: Props) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [keepId, setKeepId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  // Set only after a successful merge, once the dialog has closed — the
  // directory's own confirmation, since the modal that reported the merge
  // is gone by the time it would render.
  const [mergedNotice, setMergedNotice] = useState<string | null>(null);
  // Merge-dialog-local error: the top-of-view banner above renders behind
  // the modal backdrop, so a merge failure there was invisible (w1-c P1,
  // DEC-239) — this renders inside the modal instead.
  const [mergeError, setMergeError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    apiList<DuplicateGroup>('/contacts/duplicates')
      .then((res) => setGroups(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load duplicates'))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  function openMerge(group: DuplicateGroup) {
    setMergeGroup(group);
    setKeepId(group.contactIds[0] ?? '');
    setMergeError(null);
    setMergedNotice(null);
  }

  async function doMerge() {
    if (!mergeGroup || !keepId) return;
    setBusy(true);
    setMergeError(null);
    try {
      const mergeId = mergeGroup.contactIds.find((id) => id !== keepId);
      if (!mergeId) throw new Error('Pick a record to keep from at least two duplicates.');
      await apiPost('/contacts/merge', { keepId, mergeId });
      setMergeGroup(null);
      setMergedNotice('Contacts merged.');
      reload();
      onMerged();
    } catch (err) {
      setMergeError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chq-duplicates-view">
      <h2>Possible duplicates</h2>
      {error && <div className="chq-error-banner">{error}</div>}
      {mergedNotice && <div className="chq-success-banner">{mergedNotice}</div>}
      {loading && <p>Loading...</p>}
      {!loading && groups.length === 0 && <p>No duplicate groups found.</p>}

      <ul className="chq-duplicate-groups">
        {groups.map((g, i) => (
          <li key={i}>
            {g.contacts.map((c) => `${c.firstName} ${c.lastName} <${c.email}>`).join(' / ')}
            <button type="button" onClick={() => openMerge(g)}>
              Merge
            </button>
          </li>
        ))}
      </ul>

      {mergeGroup && (
        <div className="chq-modal-backdrop" role="dialog" aria-label="Merge duplicates">
          <div className="chq-modal">
            <h3>Merge contacts</h3>
            <p>Pick which record to keep. History from the other record moves onto the kept record.</p>
            {mergeError && <div className="chq-error-banner chq-modal-error">{mergeError}</div>}
            {mergeGroup.contacts.map((c) => (
              <label key={c.id} style={{ display: 'block' }}>
                <input type="radio" name="keep" checked={keepId === c.id} onChange={() => setKeepId(c.id)} />
                {c.firstName} {c.lastName} — {c.email} {c.company ? `— ${c.company}` : ''}
              </label>
            ))}
            <button type="button" onClick={() => setMergeGroup(null)}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={doMerge}>
              Merge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
