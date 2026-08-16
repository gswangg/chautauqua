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
import { apiGet, apiPost, ApiError } from '../../lib/api';
import { DelayedLoading } from '../../components/DelayedLoading';
import { PageSkeleton } from '../../components/PageSkeleton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { DuplicateGroup } from './types';
import { countOf } from '../../lib/plural';
// DEC-858: names that differ only by case are the same name at a merge --
// share the ONE name-identity rule the duplicate detector already uses.
import { normalizedContactName } from '../../../../src/domain/contacts';
// DEC-992: "added <date>" renders through the app's ONE date grammar --
// never a hand-rolled Intl call.
import { formatDate } from '../../lib/dates';
// DEC-748: the merge screen's own pair is resolved server-side by
// ?ids= against the SAME stably-ordered array GET /contacts/duplicates
// pages, never re-derived by scanning a (possibly-truncated) page client
// side (w39-c).
import { DEC_748 } from '../../../../src/decisions';
void DEC_748;
import './contacts-panels.css';
import './contacts.css';

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
  // DEC-026 (wave-47 amendment): the SAME whole-operation preflight the POST
  // route runs, surfaced by the preview so the Merge button can never be
  // clicked toward a refusal the write would then reject.
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);
  // DEC-748: "N of M pairs" -- this pair's position among every duplicate
  // group GET /contacts/duplicates currently reports, not a client-invented
  // count.
  const [pairPosition, setPairPosition] = useState<{ index: number; total: number } | null>(null);

  useEffect(() => {
    if (ids.length < 2) return;
    setLoading(true);
    setError(null);
    // DEC-748 (w39-c): the pair is resolved server-side by ?ids= -- the
    // server matches against the SAME stably-ordered array the unfiltered
    // list pages, so a pair past the default page still comes back with a
    // true position/total instead of the page-length this used to report.
    const query = `?ids=${ids.map(encodeURIComponent).join(',')}`;
    apiGet<{ items: DuplicateGroup[]; total: number; position: number | null }>(`/contacts/duplicates${query}`)
      .then((res) => {
        const match = res.items[0];
        if (!match) {
          setError('These records are no longer duplicates — they may already be merged.');
          setGroup(null);
          setPairPosition(null);
          return;
        }
        setGroup(match);
        setPairPosition(res.position !== null ? { index: res.position, total: res.total } : null);
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
    setBlocked(null);
    apiGet<{
      fields: MergeFieldPreview[];
      impact: { submissions: number; tasks: number };
      blocked: { code: string; message: string } | null;
    }>(`/contacts/merge/preview?ids=${ids.map(encodeURIComponent).join(',')}&keep=${encodeURIComponent(keepId)}`)
      .then((res) => {
        setPreview(res.fields);
        setImpact(res.impact);
        setBlocked(res.blocked);
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
  // indistinguishable -- append a disambiguator (see headDisambiguator
  // below).
  const soleDiscard = discardedContacts.length === 1 ? discardedContacts[0]! : null;
  const namesCollide =
    !!keepContact &&
    !!soleDiscard &&
    normalizedContactName(keepContact.firstName, keepContact.lastName) ===
      normalizedContactName(soleDiscard.firstName, soleDiscard.lastName);
  // DEC-992 amendment (wave 4): the head eyebrow row renders in small caps
  // (text-transform: uppercase) — a raw email address in that row reads as
  // SHOUTED. The collision disambiguator here is company-only (never the
  // email the pick list above uses for the same purpose); a colliding pair
  // with no company on either record simply carries no disambiguator, the
  // 'added <date>' vintage still tells them apart.
  function headDisambiguator(c: { company?: string | null }) {
    return c.company || '';
  }
  // DEC-992: the column heads name BOTH the record and its vintage --
  // "Keeping · <name>[ (disambiguator)] · added <date>" / "Discarding ·
  // ...". A 3+ group has no single discarded record to name (DEC-802), so
  // it keeps the 'N other records' fallback with no vintage -- there is no
  // one createdAt to show.
  const keepDisambiguator = namesCollide && keepContact ? headDisambiguator(keepContact) : '';
  const discardDisambiguator = namesCollide && soleDiscard ? headDisambiguator(soleDiscard) : '';
  const keepHeadLabel = keepContact
    ? `Keeping · ${keepContact.firstName} ${keepContact.lastName}${keepDisambiguator ? ` (${keepDisambiguator})` : ''} · added ${formatDate(keepContact.createdAt)}`
    : '';
  const discardHeadLabel = soleDiscard
    ? `Discarding · ${soleDiscard.firstName} ${soleDiscard.lastName}${discardDisambiguator ? ` (${discardDisambiguator})` : ''} · added ${formatDate(soleDiscard.createdAt)}`
    : `Discarding · ${discardedContacts.length} other records`;

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
      <div className="chq-page chq-measure chq-contacts-merge-page">
        <div className="chq-contacts-merge-topbar">{backLink}</div>
        <p className="chq-empty">Pick two or more duplicate records from the Duplicates tab.</p>
      </div>
    );
  }

  return (
    <div className="chq-page chq-measure chq-contacts-merge-page">
      {/* Item 10 (frame 08-contacts--05): one full-width title band --
          back link + H1 far left, '<N> of <M> pairs' right-flushed on the
          SAME row -- closed by a single 1px ink rule, replacing the
          separate left-aligned pair-count paragraph that used to sit
          further down the page. */}
      <div className="chq-contacts-merge-titleband">
        <div className="chq-contacts-merge-titleband-left">
          {backLink}
          <h1 className="chq-page-title">Merge two records</h1>
        </div>
        {pairPosition && (
          <p className="chq-contacts-merge-pair-count">
            {pairPosition.index} of {countOf(pairPosition.total, 'pair')}
          </p>
        )}
      </div>

      {loading && <PageSkeleton variant="detail" />}
      {!loading && error && <div className="chq-error">{error}</div>}

      {!loading && group && keepContact && (
        <>
          {/* Item 10: no intro paragraph -- the frame states nothing here,
              the compare table and its consequence block below carry the
              whole story. */}
          {mergeError && <div className="chq-error">{mergeError}</div>}

          {/* Item 10: the radio picks are FUNCTIONAL, not decorative --
              'Swap which is kept' only ever swaps onto the sole OTHER
              record in a two-record pair (it has no target when a group
              is 3+), so for a 3+ duplicate group (DEC-802's "N other
              records" case) this list is the only way to choose which of
              three-plus records is kept. Kept as-is; see the fidelity
              report for the two-record case where it overlaps with Swap. */}
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

          <div className="chq-contacts-merge-compare-head">
            <span>Field</span>
            <span>{keepHeadLabel}</span>
            <span>{discardHeadLabel}</span>
          </div>
          {previewError && <div className="chq-error">{previewError}</div>}
          {!previewError && !preview && <DelayedLoading />}
          {/* DEC-748 amendment (wave 2): `preview` renders verbatim -- the
              server already folds every customFields.* key into the single
              Labels row (DEC-738) before it reaches the client. */}
          {preview?.map((f) => {
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
          {preview && preview.length === 0 && (
            <p className="chq-contacts-merge-compare-empty">Every field already matches — nothing else will change.</p>
          )}

          {/* Item 10 (frame 08-contacts--05): ONE #EFEBDF consequence block
              BELOW the comparison table -- the combine rule and the real
              submissions/tasks impact used to sit on opposite sides of the
              table (rule box above, impact line below); the frame draws
              them as one box after it. The frame's box also states the
              discarded-record deletion inline (not only in the confirm
              dialog), so this line now carries it too. */}
          <div className="chq-contacts-merge-rule-box">
            <p className="chq-contacts-merge-rule-box-rule">Labels combine, notes are appended</p>
            {impact && keepContact && (
              <p className="chq-contacts-merge-impact">
                {countOf(impact.submissions, 'submission')} and {countOf(impact.tasks, 'task')} move to{' '}
                {keepContact.firstName} {keepContact.lastName}. The discarded record is deleted.
              </p>
            )}
          </div>

          {blocked && <div className="chq-error chq-contacts-merge-blocked">{blocked.message}</div>}

          {/* Item 10: the footer row now carries Merge / 'Swap which is
              kept' / 'Not a duplicate' TOGETHER -- 'Not a duplicate' used
              to be stranded below this row as its own element. */}
          <div className="chq-contacts-merge-footer">
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              disabled={!!blocked}
              onClick={() => setConfirmOpen(true)}
            >
              {keepContact ? `Merge into ${keepContact.firstName} ${keepContact.lastName}` : 'Merge'}
            </button>
            {/* DEC-992: 'Swap which is kept' sits beside the primary as a
                control, rather than being buried back in the pick list
                above -- only renders for a two-record pair, which is the
                only shape with a single other record to swap onto. */}
            {soleDiscard && (
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                onClick={() => setKeepId(soleDiscard.id)}
              >
                Swap which is kept
              </button>
            )}
            {/* DEC-734: 'Not a duplicate' -- these records aren't the same
                person, dismiss the pair (session-only, same mechanism as
                DuplicatesView's own 'Keep both') and land back on the tab.
                DEC-992's own reasoning for keeping this a text link, not a
                boxed chq-btn, stands -- only its position changed. */}
            <button
              type="button"
              className="chq-contacts-merge-not-duplicate"
              disabled={notDuplicateBusy}
              onClick={() => notADuplicate(group)}
            >
              Not a duplicate
            </button>
          </div>

          {confirmOpen && (
            <ConfirmDialog
              title="Merge these records?"
              body="History from the other record moves onto the kept record. The discarded record is deleted. This can't be undone."
              confirmLabel="Merge contacts"
              weight="irreversible"
              confirmPhrase={
                soleDiscard
                  ? `${soleDiscard.firstName} ${soleDiscard.lastName}`
                  : discardedContacts.map((c) => `${c.firstName} ${c.lastName}`).join(', ')
              }
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
