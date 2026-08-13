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
import { apiList, apiGet, apiPost, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { DuplicateGroup } from './types';
// DEC-738: Labels combine from every record's customFields, formatted by
// the ONE server-importable formatter -- never a hand-copied "`key` value"
// join here.
import { contactLabels } from '../../../../src/domain/contact-labels';
// DEC-858: names that differ only by case are the same name at a merge --
// share the ONE name-identity rule the duplicate detector already uses.
import { normalizedContactName } from '../../../../src/domain/contacts';
import './contacts-panels.css';

// DEC-705: what the merge will actually write, computed server-side by the
// SAME pure-core merge fold POST /contacts/merge uses (never re-derived
// here) -- so this page never lies about a field the compact three-field
// table above used to hide (blank-fill, appended notes, unioned custom
// fields).
interface MergeFieldPreview {
  key: string;
  label: string;
  kept: string;
  discarded: string[];
  outcome: 'keep' | 'fill' | 'append' | 'combine';
}

function outcomeNote(outcome: MergeFieldPreview['outcome']): string | null {
  if (outcome === 'append') return 'will be appended';
  if (outcome === 'combine') return 'will be added';
  if (outcome === 'fill') return 'filled in';
  return null;
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
  const [notDuplicateBusy, setNotDuplicateBusy] = useState(false);
  const [preview, setPreview] = useState<MergeFieldPreview[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // DEC-802: the merge preview's "N submissions and M tasks move to
  // <keeper>" impact line -- counted server-side, never re-derived here.
  const [impact, setImpact] = useState<{ submissions: number; tasks: number } | null>(null);
  // DEC-748: "N of M pairs" -- this pair's position among every duplicate
  // group GET /contacts/duplicates currently reports, not a client-invented
  // count.
  const [pairPosition, setPairPosition] = useState<{ index: number; total: number } | null>(null);

  useEffect(() => {
    if (ids.length < 2) return;
    setLoading(true);
    setError(null);
    const idSet = new Set(ids);
    apiList<DuplicateGroup>('/contacts/duplicates')
      .then((res) => {
        const matchIndex = res.items.findIndex(
          (g) => g.contactIds.length === idSet.size && g.contactIds.every((id) => idSet.has(id)),
        );
        const match = matchIndex === -1 ? undefined : res.items[matchIndex];
        if (!match) {
          setError('These records are no longer duplicates — they may already be merged.');
          setGroup(null);
          setPairPosition(null);
          return;
        }
        setGroup(match);
        setPairPosition({ index: matchIndex + 1, total: res.items.length });
        setKeepId(keepParam && match.contactIds.includes(keepParam) ? keepParam : (match.contactIds[0] ?? ''));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load duplicate records'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  useEffect(() => {
    if (ids.length < 2 || !keepId) return;
    setPreview(null);
    setPreviewError(null);
    setImpact(null);
    apiGet<{ fields: MergeFieldPreview[]; impact: { submissions: number; tasks: number } }>(
      `/contacts/merge/preview?ids=${ids.map(encodeURIComponent).join(',')}&keep=${encodeURIComponent(keepId)}`,
    )
      .then((res) => {
        setPreview(res.fields);
        setImpact(res.impact);
      })
      .catch((err) => setPreviewError(err instanceof ApiError ? err.message : 'Failed to load merge preview'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam, keepId]);

  const keepContact = group?.contacts.find((c) => c.id === keepId) ?? null;
  // DEC-802: the third column is headed by the discarded record's own
  // name, not the literal 'Discard' -- a 3+ group has no single discarded
  // record to name, so it reads 'N other records' instead.
  const discardedContacts = group?.contacts.filter((c) => c.id !== keepId) ?? [];
  // DEC-834: when the keeper's and the sole discarded record's display
  // names are identical, the two compare-table column heads are otherwise
  // indistinguishable -- append the same disambiguator the pick list above
  // already shows for that purpose (email, else company).
  function disambiguator(c: { email: string; company?: string | null }) {
    return c.email || c.company || '';
  }
  const soleDiscard = discardedContacts.length === 1 ? discardedContacts[0]! : null;
  const namesCollide =
    !!keepContact &&
    !!soleDiscard &&
    normalizedContactName(keepContact.firstName, keepContact.lastName) ===
      normalizedContactName(soleDiscard.firstName, soleDiscard.lastName);
  const keepHeadLabel = keepContact
    ? namesCollide
      ? `${keepContact.firstName} ${keepContact.lastName} (${disambiguator(keepContact)})`
      : `${keepContact.firstName} ${keepContact.lastName}`
    : '';
  const discardHeadLabel = soleDiscard
    ? namesCollide
      ? `${soleDiscard.firstName} ${soleDiscard.lastName} (${disambiguator(soleDiscard)})`
      : `${soleDiscard.firstName} ${soleDiscard.lastName}`
    : `${discardedContacts.length} other records`;

  // DEC-770: 'Not a duplicate' persists the dismissal (POST
  // /contacts/duplicates/dismiss) BEFORE navigating back -- a fact about
  // the pair, not a session mood. The dismiss endpoint's wire contract is
  // pairwise ({contactIds: [a, b]}); a group is always two contacts in
  // this UI (findDuplicateGroups' 3+ email-bucket case has no single pair
  // this page could name), so group.contactIds is used as-is.
  async function notADuplicate(group: DuplicateGroup) {
    setNotDuplicateBusy(true);
    setMergeError(null);
    try {
      await apiPost('/contacts/duplicates/dismiss', { contactIds: group.contactIds.slice(0, 2) });
      navigate('/contacts', {
        state: { panel: 'duplicates', notice: 'Marked as not a duplicate.', dismissPairIds: group.contactIds },
      });
    } catch (err) {
      setMergeError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to dismiss pair');
    } finally {
      setNotDuplicateBusy(false);
    }
  }

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
                {c.firstName} {c.lastName} — {c.email}
                {c.company ? ` — ${c.company}` : ''}
                {c.title ? ` — ${c.title}` : ''}
              </label>
            ))}
          </div>

          {pairPosition && (
            <p className="chq-contacts-merge-pair-count">
              {pairPosition.index} of {pairPosition.total} {pairPosition.total === 1 ? 'pair' : 'pairs'}
            </p>
          )}

          <div className="chq-contacts-merge-compare-head">
            <span>Field</span>
            <span>{keepHeadLabel}</span>
            <span>{discardHeadLabel}</span>
          </div>
          {previewError && <div className="chq-error">{previewError}</div>}
          {!previewError && !preview && <DelayedLoading />}
          {/* DEC-738: customFields.* preview rows are folded into the single
              Labels row below (labels COMBINE, they are not chosen field by
              field) instead of listing each raw custom-field key here. */}
          {preview?.filter((f) => !f.key.startsWith('customFields.')).map((f) => {
            const note = outcomeNote(f.outcome);
            // DEC-802: only a REAL dropped value is struck -- a keeper-only
            // row (nothing actually discarded, `discarded` empty or all
            // blank) renders a plain em dash, not the struck 'drop' class,
            // since strike styling is evidence of a real loss, not
            // decoration.
            const hasRealDiscard = f.discarded.some((d) => d !== '');
            return (
              <div key={f.key} className="chq-contacts-merge-compare-row">
                <span className="chq-contacts-merge-compare-label">{f.label}</span>
                <span className="chq-contacts-merge-compare-keep">{f.kept || '—'}</span>
                <span
                  className={
                    note
                      ? 'chq-contacts-merge-compare-combine'
                      : hasRealDiscard
                        ? 'chq-contacts-merge-compare-drop'
                        : 'chq-contacts-merge-compare-blank'
                  }
                >
                  {note
                    ? `${f.discarded.length > 0 ? f.discarded.join(' / ') + ' — ' : ''}${note}`
                    : hasRealDiscard
                      ? f.discarded.map((d) => (d === '' ? '—' : d)).join(' / ')
                      : '—'}
                </span>
              </div>
            );
          })}
          {preview && (() => {
            const combinedCustomFields: Record<string, string> = {};
            for (const f of preview) {
              if (f.key.startsWith('customFields.')) {
                combinedCustomFields[f.key.slice('customFields.'.length)] = f.kept;
              }
            }
            const labels = contactLabels(combinedCustomFields);
            if (labels.length === 0) return null;
            return (
              <div className="chq-contacts-merge-compare-row">
                <span className="chq-contacts-merge-compare-label">Labels</span>
                <span className="chq-contacts-merge-compare-keep">{labels.join(', ')}</span>
                <span className="chq-contacts-merge-compare-combine">combined from both records</span>
              </div>
            );
          })()}
          {preview && preview.length === 0 && (
            <p className="chq-contacts-merge-compare-empty">Every field already matches — nothing else will change.</p>
          )}
          {preview && preview.some((f) => f.key.startsWith('customFields.')) && (
            <p className="chq-contacts-merge-footnote">Labels always combine — they're never chosen one over the other.</p>
          )}
          {/* DEC-834: the second rule that is NOT 'pick a side' -- notes are
              appended (DEC-266/DEC-705), not chosen -- must be visible
              beside the labels footnote before committing an irreversible
              merge. */}
          {preview && (
            <p className="chq-contacts-merge-footnote">Labels combine, notes are appended</p>
          )}

          {impact && keepContact && (
            <p className="chq-contacts-merge-impact">
              {impact.submissions} {impact.submissions === 1 ? 'submission' : 'submissions'} and {impact.tasks}{' '}
              {impact.tasks === 1 ? 'task' : 'tasks'} move to {keepContact.firstName} {keepContact.lastName}.
            </p>
          )}

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
            {/* DEC-734: 'Not a duplicate' -- these records aren't the same
                person, dismiss the pair (session-only, same mechanism as
                DuplicatesView's own 'Keep both') and land back on the tab. */}
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={notDuplicateBusy}
              onClick={() => notADuplicate(group)}
            >
              Not a duplicate
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
