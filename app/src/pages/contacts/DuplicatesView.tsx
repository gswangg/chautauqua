// Duplicates + merge (CRM, DEC-239). Behaviour frozen (DEC-366): merge and
// not-a-duplicate semantics are untouched — POST /contacts/merge with
// {keepId, mergeId} drawn from the group's real `contactIds`.
//
// Redesign (w2-e, DEC-366..368/372/376/377): the merge dialog now shows a
// field-by-field comparison (mock "Duplicates · merge"): the value kept on
// the surviving record in ink, and every differing value from the records
// being discarded struck through in var(--chq-muted) with the ONE
// off-palette hex the whole app permits, #A8A392 (DEC-376) — that colour
// appears nowhere else in this lane's stylesheet.
import { useEffect, useState } from 'react';
import { apiList, apiPost, ApiError } from '../../lib/api';
import type { DuplicateGroup } from './types';
import './contacts-panels.css';

interface Props {
  onMerged: () => void;
}

const COMPARE_FIELDS: { label: string; key: 'name' | 'email' | 'company' }[] = [
  { label: 'Name', key: 'name' },
  { label: 'Email', key: 'email' },
  { label: 'Company', key: 'company' },
];

function fieldValue(c: DuplicateGroup['contacts'][number], key: 'name' | 'email' | 'company'): string {
  if (key === 'name') return `${c.firstName} ${c.lastName}`.trim();
  if (key === 'email') return c.email;
  return c.company ?? '—';
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

  const groupIndex = mergeGroup ? groups.indexOf(mergeGroup) : -1;
  const keepContact = mergeGroup?.contacts.find((c) => c.id === keepId) ?? null;
  const otherContacts = mergeGroup ? mergeGroup.contacts.filter((c) => c.id !== keepId) : [];

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
      {loading && <p>Loading...</p>}
      {!loading && groups.length === 0 && <p className="chq-empty">No duplicate groups found.</p>}

      <ul className="chq-contacts-duplicate-groups">
        {groups.map((g, i) => (
          <li key={i} className="chq-contacts-duplicate-group">
            <span className="chq-contacts-duplicate-names">
              {g.contacts.map((c) => `${c.firstName} ${c.lastName} <${c.email}>`).join(' / ')}
            </span>
            <div className="chq-contacts-import-actions">
              <button type="button" className="chq-btn chq-btn-primary" onClick={() => openMerge(g)}>
                Merge
              </button>
            </div>
          </li>
        ))}
      </ul>

      {mergeGroup && keepContact && (
        <div className="chq-modal-backdrop" role="dialog" aria-label="Merge duplicates">
          <div className="chq-modal">
            <h3 className="chq-page-title">Merge contacts</h3>
            <p className="chq-contacts-merge-intro">
              {groupIndex >= 0 ? `${groupIndex + 1} of ${groups.length} pairs · ` : ''}
              Pick which record to keep. History from the other record moves onto the kept record.
            </p>
            {mergeError && <div className="chq-error chq-modal-error">{mergeError}</div>}

            <div className="chq-contacts-merge-picks">
              {mergeGroup.contacts.map((c) => (
                <label key={c.id} className="chq-contacts-merge-pick">
                  <input
                    className="chq-check"
                    type="radio"
                    name="keep"
                    checked={keepId === c.id}
                    onChange={() => setKeepId(c.id)}
                  />
                  {c.firstName} {c.lastName} — {c.email} {c.company ? `— ${c.company}` : ''}
                </label>
              ))}
            </div>

            <div className="chq-contacts-merge-compare-head">
              <span>Field</span>
              <span>Keep this one</span>
              <span>Discard</span>
            </div>
            {COMPARE_FIELDS.map((f) => (
              <div key={f.key} className="chq-contacts-merge-compare-row">
                <span className="chq-contacts-merge-compare-label">{f.label}</span>
                <span className="chq-contacts-merge-compare-keep">{fieldValue(keepContact, f.key)}</span>
                <span className="chq-contacts-merge-compare-drop">
                  {otherContacts
                    .map((c) => fieldValue(c, f.key))
                    .filter((v) => v !== fieldValue(keepContact, f.key))
                    .join(' / ') || '—'}
                </span>
              </div>
            ))}

            <div className="chq-contacts-import-actions">
              <button type="button" className="chq-btn chq-btn-primary" disabled={busy} onClick={doMerge}>
                Merge
              </button>
              <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setMergeGroup(null)}>
                Not a duplicate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
