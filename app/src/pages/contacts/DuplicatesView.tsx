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
    setKeepId(group.ids[0] ?? '');
  }

  async function doMerge() {
    if (!mergeGroup || !keepId) return;
    const mergeId = mergeGroup.ids.find((id) => id !== keepId);
    if (!mergeId) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/contacts/merge', { keepId, mergeId });
      setMergeGroup(null);
      reload();
      onMerged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Merge failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chq-duplicates-view">
      <h2>Possible duplicates</h2>
      {error && <div className="chq-error-banner">{error}</div>}
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
