// Settings · Sponsorships, the Edit tier modal (Portals frame, flow 5,
// "Edit tier · from Settings · Sponsorships"): a tier's name and the rows
// that become one slot each in every sponsor's package on it. On an
// existing tier with sponsors, every edit asks the server which sponsors
// would hold more sessions than the new allowance (POST .../preview, which
// writes nothing) and lists them before Save; saving never removes a
// session. Also the New tier form, and Delete tier.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiPost, apiPut, ApiError } from '../../lib/api';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MAX_TIER_NAME } from '../../lib/domain-caps';
import { SLOT_STATUS_WORDS } from './sponsorCopy';
import { EntitlementRows, draftsFrom, draftsSignature, draftsToInput, newDraft, type EntitlementDraft } from './EntitlementRows';
import type { OverAllowance, SponsorSessionStatus, TierRow } from './types';

interface EditTierModalProps {
  eventId: string;
  // null: the New tier form
  tier: TierRow | null;
  formats: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

// How long the editor waits after the last change before asking the
// server for the over-allowance preview.
const PREVIEW_DEBOUNCE_MS = 300;

function statusWord(status: string): string {
  return status in SLOT_STATUS_WORDS ? SLOT_STATUS_WORDS[status as SponsorSessionStatus].toLowerCase() : status;
}

export function EditTierModal({ eventId, tier, formats, onClose, onSaved }: EditTierModalProps) {
  const [name, setName] = useState(tier?.name ?? '');
  const [rows, setRows] = useState<EntitlementDraft[]>(() =>
    tier ? draftsFrom(tier.entitlements) : formats.length > 0 ? [newDraft(formats)] : [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [over, setOver] = useState<OverAllowance[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TierRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const savedSignature = useMemo(() => (tier ? draftsSignature(draftsFrom(tier.entitlements)) : ''), [tier]);
  const signature = draftsSignature(rows);
  const previewable = tier !== null && tier.sponsors > 0;

  useEffect(() => {
    if (!previewable || !tier) return;
    setPreviewError(null);
    if (signature === savedSignature) {
      setOver([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiPost<{ over: OverAllowance[] }>(`/events/${eventId}/sponsor-tiers/${tier.id}/preview`, {
        entitlements: draftsToInput(rows),
      })
        .then((res) => {
          if (!cancelled) setOver(res.over);
        })
        .catch((err) => {
          // the preview is advice; a failed one says so instead of
          // implying nobody would be over
          if (!cancelled) setPreviewError(err instanceof ApiError ? err.message : 'Could not check which sponsors would be over.');
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // rows is captured through its signature
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, savedSignature, previewable, eventId, tier]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNameError(null);
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError('Give the tier a name.');
      return;
    }
    setSaving(true);
    try {
      const body = { name: trimmed, entitlements: draftsToInput(rows) };
      if (tier) {
        await apiPut(`/events/${eventId}/sponsor-tiers/${tier.id}`, body);
        onSaved(`${trimmed} saved.`);
      } else {
        await apiPost(`/events/${eventId}/sponsor-tiers`, body);
        onSaved(`${trimmed} added.`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields?.name) setNameError(err.message);
      else setError(err instanceof ApiError ? err.message : 'Could not save this tier.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiDelete(`/events/${eventId}/sponsor-tiers/${pendingDelete.id}`);
      onSaved(`${pendingDelete.name} deleted.`);
    } catch (err) {
      // the API refuses a tier that still has sponsors; its message says
      // what to do
      setError(err instanceof ApiError ? err.message : 'Could not delete this tier.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const tierLabel = name.trim() || 'tier';
  const busy = saving || deleting;

  return (
    <>
      <ModalFrame
        as="form"
        onSubmit={save}
        title={tier ? tier.name : 'New tier'}
        onClose={onClose}
        closeDisabled={busy || pendingDelete !== null}
        modalClassName="chq-tier-modal"
        actions={
          <>
            <button type="submit" className="chq-btn chq-btn-primary" disabled={busy}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            {tier ? (
              <button
                type="button"
                className="chq-btn chq-btn-destructive-tertiary chq-tier-delete"
                onClick={() => setPendingDelete(tier)}
                disabled={busy}
              >
                Delete tier
              </button>
            ) : null}
          </>
        }
      >
        {error ? (
          <div className="chq-error" role="alert">
            {error}
          </div>
        ) : null}
        <FormRow label="Tier name" htmlFor="tier-name" error={nameError}>
          <input
            id="tier-name"
            className="chq-input"
            value={name}
            maxLength={MAX_TIER_NAME}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </FormRow>
        <div className="chq-tier-rows-block">
          <span className="chq-tier-rows-label">{`Each ${tierLabel} sponsor can create`}</span>
          {rows.length === 0 && formats.length > 0 ? <p className="chq-tier-rows-empty">Nothing yet. Add a session type.</p> : null}
          <EntitlementRows idPrefix="tier" rows={rows} formats={formats} onChange={setRows} disabled={busy} />
        </div>
        {formats.length === 0 ? (
          <>
            <p className="chq-tier-help">This event has no session formats yet. Add them in Settings · Call for papers, then come back.</p>
            <Link to="/settings?section=cfp" className="chq-link-button chq-tier-cfp-link">
              Open Call for papers
            </Link>
          </>
        ) : (
          <p className="chq-tier-help">Formats and lengths come from Settings · Call for papers.</p>
        )}
        {previewError ? <p className="chq-tier-help">{previewError}</p> : null}
        {over.length > 0 ? (
          <div className="chq-tier-over" role="status">
            <span className="chq-tier-over-label">Over the new allowance</span>
            <ul className="chq-tier-over-list">
              {over.map((o) => (
                <li key={o.sponsorshipId}>
                  <strong>{o.companyName}</strong>
                  {': '}
                  {o.sessions.map((held) => `${held.title || 'Untitled session'} (${statusWord(held.status)})`).join(', ')}
                </li>
              ))}
            </ul>
            <span className="chq-tier-over-note">Saving keeps these sessions. Approved sessions are never removed.</span>
          </div>
        ) : null}
      </ModalFrame>
      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete the ${pendingDelete.name} tier?`}
          body="Its session types go with it. A tier with sponsors on it can't be deleted; move them to another tier first."
          confirmLabel="Delete tier"
          pending={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  );
}
