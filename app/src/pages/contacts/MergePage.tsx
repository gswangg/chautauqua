// Contact merge (DEC-684): merge is a PAGE at its own URL, not a modal —
// an irreversible action gets a page, not window.confirm/a dialog stacked on
// the directory. The records to merge travel in the query string
// (?ids=<id>,<id>[,...]&keep=<id>) so the page survives a reload and can be
// linked/bookmarked (mock "Duplicates · merge" desktop + "Merge · 390" phone
// frames — full-page surface, no chq-scrim/ModalFrame here).
//
// DEC-629: POST /contacts/merge stays set-based — {keepId, mergeIds} where
// mergeIds is every other id in the group, sent in ONE request. The group's
// real field data (name/email/company) is drawn from GET /contacts/duplicates
// — the same data DuplicatesView already fetches — matched by the exact set
// of ids named in the query string, rather than a new by-ids endpoint.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { DuplicateGroup } from './types';
import './contacts-panels.css';

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

export function MergePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const idsParam = searchParams.get('ids') ?? '';
  const keepParam = searchParams.get('keep');
  const ids = idsParam
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');

  const [group, setGroup] = useState<DuplicateGroup | null>(null);
  const [keepId, setKeepId] = useState<string>('');
  const [loading, setLoading] = useState(ids.length >= 2);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length < 2) return;
    setLoading(true);
    setError(null);
    const idSet = new Set(ids);
    apiList<DuplicateGroup>('/contacts/duplicates')
      .then((res) => {
        const match = res.items.find(
          (g) => g.contactIds.length === idSet.size && g.contactIds.every((id) => idSet.has(id)),
        );
        if (!match) {
          setError('These records are no longer duplicates — they may already be merged.');
          setGroup(null);
          return;
        }
        setGroup(match);
        setKeepId(keepParam && match.contactIds.includes(keepParam) ? keepParam : (match.contactIds[0] ?? ''));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load duplicate records'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  const keepContact = group?.contacts.find((c) => c.id === keepId) ?? null;
  const otherContacts = group ? group.contacts.filter((c) => c.id !== keepId) : [];

  async function doMerge() {
    if (!group || !keepId) return;
    setBusy(true);
    setMergeError(null);
    try {
      const mergeIds = group.contactIds.filter((id) => id !== keepId);
      await apiPost('/contacts/merge', { keepId, mergeIds });
      navigate('/contacts', { state: { panel: 'duplicates', notice: 'Contacts merged.' } });
    } catch (err) {
      setMergeError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Merge failed');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const backLink = (
    <Link to="/contacts" state={{ panel: 'duplicates' }} className="chq-contacts-merge-back">
      &lsaquo; Contacts &middot; Duplicates
    </Link>
  );

  if (ids.length < 2) {
    return (
      <div className="chq-page chq-contacts-merge-page">
        <div className="chq-contacts-merge-topbar">{backLink}</div>
        <p className="chq-empty">Pick two or more duplicate records from the Duplicates tab.</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-contacts-merge-page">
      <div className="chq-contacts-merge-topbar">{backLink}</div>
      <h1 className="chq-page-title">Merge two records</h1>

      {loading && <DelayedLoading />}
      {!loading && error && <div className="chq-error">{error}</div>}

      {!loading && group && keepContact && (
        <>
          <p className="chq-contacts-merge-intro">
            Pick which record to keep. History from the other record moves onto the kept record.
          </p>
          {mergeError && <div className="chq-error">{mergeError}</div>}

          <div className="chq-contacts-merge-picks">
            {group.contacts.map((c) => (
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

          <div className="chq-contacts-merge-footer">
            <button type="button" className="chq-btn chq-btn-primary" onClick={() => setConfirmOpen(true)}>
              Merge
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => navigate('/contacts', { state: { panel: 'duplicates' } })}
            >
              Cancel
            </button>
          </div>

          {confirmOpen && (
            <ConfirmDialog
              title="Merge these records?"
              body="History from the other record moves onto the kept record. This can't be undone."
              confirmLabel="Merge"
              destructive
              pending={busy}
              onConfirm={doMerge}
              onCancel={() => setConfirmOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
