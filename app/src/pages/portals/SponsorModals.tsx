// Settings · Sponsorships, the two sponsor dialogs (Portals frame, flow 5).
// AddSponsorModal: a company on a tier, active or pending, with an optional
// first contact (POST /sponsorships). SponsorModal: one sponsor, opened
// from its row -- tier and status, the package (which session uses which
// slot, and any session over the allowance), per-sponsor extras on top of
// the tier ("one more talk for Riverbed", the same row editor as a tier),
// and its contacts. Tier, status and extras save together with Save;
// adding or removing a contact acts at once, since each is its own write.
import { useEffect, useState, type FormEvent } from 'react';
import { apiDelete, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCachedGet } from '../../lib/useCachedRead';
import { ModalFrame, FormRow, FormRowPair } from '../../components/ModalFrame';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageSkeleton } from '../../components/PageSkeleton';
import { countOf } from '../../lib/plural';
import { formatDate } from '../../lib/dates';
import { MAX_EMAIL_LENGTH, MAX_PERSON_NAME, MAX_SPONSOR_NAME } from '../../lib/domain-caps';
import { slotLabel } from '../../../../src/domain/sponsors';
import { SPONSORSHIP_STATUSES } from '../../../../src/domain/portals/participations';
import { SLOT_STATUS_WORDS, slotMark } from './sponsorCopy';
import { EntitlementRows, draftsFrom, draftsSignature, draftsToInput, type EntitlementDraft } from './EntitlementRows';
import type { SponsorContactRow, SponsorshipDetail, SponsorshipStatus, TierRow } from './types';

const STATUS_LABELS: Record<SponsorshipStatus, string> = { active: 'Active', pending: 'Pending' };

function StatusChoice({
  value,
  onChange,
  disabled,
}: {
  value: SponsorshipStatus;
  onChange: (v: SponsorshipStatus) => void;
  disabled: boolean;
}) {
  return (
    <div className="chq-segmented" role="group" aria-label="Status">
      {[...SPONSORSHIP_STATUSES].reverse().map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? 'chq-btn chq-btn-primary' : 'chq-btn chq-btn-secondary'}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          disabled={disabled}
        >
          {STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

function TierSelect({
  id,
  tiers,
  value,
  onChange,
  disabled,
}: {
  id: string;
  tiers: TierRow[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <select id={id} className="chq-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {tiers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
      <option value="">No tier</option>
    </select>
  );
}

// ---------------------------------------------------------------------------
// Add sponsor
// ---------------------------------------------------------------------------

interface AddSponsorModalProps {
  eventId: string;
  tiers: TierRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function AddSponsorModal({ eventId, tiers, onClose, onSaved }: AddSponsorModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [tierId, setTierId] = useState(tiers[0]?.id ?? '');
  const [status, setStatus] = useState<SponsorshipStatus>('active');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const problems: Record<string, string> = {};
    if (companyName.trim() === '') problems.companyName = 'Enter the company name.';
    const anyContact = firstName.trim() !== '' || lastName.trim() !== '' || email.trim() !== '';
    if (anyContact && firstName.trim() === '') problems.name = "Enter their first name, or leave the contact empty.";
    if (anyContact && email.trim() === '') problems.email = "Enter their email, or leave the contact empty.";
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setSaving(true);
    try {
      // an empty first contact is left out of the body (undefined is
      // dropped by JSON)
      await apiPost(`/events/${eventId}/sponsorships`, {
        companyName: companyName.trim(),
        tierId: tierId === '' ? null : tierId,
        status,
        contact: anyContact ? { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() } : undefined,
      });
      onSaved(`${companyName.trim()} added.`);
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        const mapped: Record<string, string> = {};
        for (const key of Object.keys(err.fields)) mapped[key] = err.message;
        setFieldErrors(mapped);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not add this sponsor.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={save}
      title="Add sponsor"
      onClose={onClose}
      closeDisabled={saving}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={saving}>
            {saving ? 'Adding…' : 'Add sponsor'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </>
      }
    >
      {error ? (
        <div className="chq-error" role="alert">
          {error}
        </div>
      ) : null}
      <FormRow label="Company" htmlFor="sponsor-company" error={fieldErrors.companyName}>
        <input
          id="sponsor-company"
          className="chq-input"
          value={companyName}
          maxLength={MAX_SPONSOR_NAME}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={saving}
        />
      </FormRow>
      <FormRowPair>
        <FormRow label="Tier" htmlFor="sponsor-tier" error={fieldErrors.tierId}>
          <TierSelect id="sponsor-tier" tiers={tiers} value={tierId} onChange={setTierId} disabled={saving} />
        </FormRow>
        <FormRow label="Status" help="Pending: agreed, not yet confirmed." error={fieldErrors.status}>
          <StatusChoice value={status} onChange={setStatus} disabled={saving} />
        </FormRow>
      </FormRowPair>
      <div className="chq-sponsor-block">
        <div className="chq-section-head">
          <span className="chq-section-label">First contact</span>
        </div>
        <p className="chq-sponsor-block-empty">Optional. They become the sponsor's primary contact.</p>
        <FormRowPair>
          <FormRow label="First name" htmlFor="sponsor-first" error={fieldErrors.name}>
            <input
              id="sponsor-first"
              className="chq-input"
              value={firstName}
              maxLength={MAX_PERSON_NAME}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={saving}
            />
          </FormRow>
          <FormRow label="Last name" htmlFor="sponsor-last">
            <input
              id="sponsor-last"
              className="chq-input"
              value={lastName}
              maxLength={MAX_PERSON_NAME}
              onChange={(e) => setLastName(e.target.value)}
              disabled={saving}
            />
          </FormRow>
        </FormRowPair>
        <FormRow label="Email" htmlFor="sponsor-email" error={fieldErrors.email}>
          <input
            id="sponsor-email"
            className="chq-input"
            type="email"
            value={email}
            maxLength={MAX_EMAIL_LENGTH}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
          />
        </FormRow>
      </div>
    </ModalFrame>
  );
}

// ---------------------------------------------------------------------------
// One sponsor
// ---------------------------------------------------------------------------

interface SponsorModalProps {
  eventId: string;
  sponsorshipId: string;
  companyName: string;
  tiers: TierRow[];
  formats: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

function contactLine(c: SponsorContactRow): string {
  if (c.status === 'invited') return c.invitedAt ? `Invited ${formatDate(c.invitedAt)} · not joined yet` : 'Invited · not joined yet';
  return c.joinedAt ? `Joined ${formatDate(c.joinedAt)}` : 'Joined';
}

export function SponsorModal({ eventId, sponsorshipId, companyName, tiers, formats, onClose, onSaved }: SponsorModalProps) {
  const detail = useCachedGet<SponsorshipDetail>(`/events/${eventId}/sponsorships/${sponsorshipId}`, 'Could not load this sponsor.');

  // the editable fields seed once from the first payload; later refetches
  // (after a contact is added) never overwrite what the organizer typed
  const [seeded, setSeeded] = useState(false);
  const [tierId, setTierId] = useState('');
  const [status, setStatus] = useState<SponsorshipStatus>('active');
  const [extras, setExtras] = useState<EntitlementDraft[]>([]);
  const [savedExtras, setSavedExtras] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [primary, setPrimary] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactNote, setContactNote] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SponsorContactRow | null>(null);

  useEffect(() => {
    if (seeded || !detail.data) return;
    const d = detail.data;
    setTierId(d.sponsorship.tierId ?? '');
    setStatus(d.sponsorship.status);
    const own = draftsFrom(d.entitlements.filter((e) => e.extra));
    setExtras(own);
    setSavedExtras(draftsSignature(own));
    setSeeded(true);
  }, [detail.data, seeded]);

  const d = detail.data;
  const tierChanged = d ? tierId !== (d.sponsorship.tierId ?? '') : false;
  const statusChanged = d ? status !== d.sponsorship.status : false;
  const extrasChanged = seeded && draftsSignature(extras) !== savedExtras;
  const dirty = tierChanged || statusChanged || extrasChanged;
  const tierName = tiers.find((t) => t.id === (d?.sponsorship.tierId ?? ''))?.name ?? null;

  async function save() {
    if (!dirty) return;
    setError(null);
    setSaving(true);
    try {
      // only what changed is sent (undefined is dropped by JSON)
      await apiPatch(`/events/${eventId}/sponsorships/${sponsorshipId}`, {
        tierId: tierChanged ? (tierId === '' ? null : tierId) : undefined,
        status: statusChanged ? status : undefined,
        extras: extrasChanged ? draftsToInput(extras) : undefined,
      });
      onSaved(`${companyName} saved.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this sponsor.');
    } finally {
      setSaving(false);
    }
  }

  async function addContact(e: FormEvent) {
    e.preventDefault();
    setContactError(null);
    setContactNote(null);
    if (first.trim() === '' || email.trim() === '') {
      setContactError('Enter a first name and an email.');
      return;
    }
    setContactBusy(true);
    try {
      await apiPost(`/events/${eventId}/sponsorships/${sponsorshipId}/contacts`, { firstName: first.trim(), lastName: last.trim(), email: email.trim(), primary });
      setContactNote(`${`${first.trim()} ${last.trim()}`.trim()} added.`);
      setFirst('');
      setLast('');
      setEmail('');
      setPrimary(false);
      setAdding(false);
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : 'Could not add this contact.');
    } finally {
      setContactBusy(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setContactError(null);
    setContactNote(null);
    setContactBusy(true);
    try {
      await apiDelete(`/events/${eventId}/sponsorships/${sponsorshipId}/contacts/${pendingRemove.id}`);
      setContactNote(`${pendingRemove.name} removed.`);
    } catch (err) {
      // the API refuses the primary contact; its message says what to do
      setContactError(err instanceof ApiError ? err.message : 'Could not remove this contact.');
    } finally {
      setPendingRemove(null);
      setContactBusy(false);
    }
  }

  const busy = saving || contactBusy;
  const subtitle = d ? `${tierName ?? 'No tier'} · ${countOf(d.contacts.length, 'contact')}` : undefined;

  return (
    <>
      <ModalFrame
        title={companyName}
        subtitle={subtitle}
        onClose={onClose}
        closeDisabled={busy || pendingRemove !== null}
        size="wide"
        modalClassName="chq-sponsor-modal"
        actions={
          d ? (
            <>
              <button type="button" className="chq-btn chq-btn-primary" onClick={() => void save()} disabled={busy || !dirty}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={busy}>
                {dirty ? 'Cancel' : 'Close'}
              </button>
            </>
          ) : undefined
        }
      >
        {!d && detail.error ? (
          <div className="chq-error" role="alert">
            {detail.error}
          </div>
        ) : null}
        {!d && !detail.error ? <PageSkeleton variant="list" label="Loading this sponsor…" /> : null}
        {d ? (
          <>
            {error ? (
              <div className="chq-error" role="alert">
                {error}
              </div>
            ) : null}
            <FormRowPair>
              <FormRow label="Tier" htmlFor="sponsor-detail-tier">
                <TierSelect id="sponsor-detail-tier" tiers={tiers} value={tierId} onChange={setTierId} disabled={busy} />
              </FormRow>
              <FormRow label="Status" help="Pending: agreed, not yet confirmed.">
                <StatusChoice value={status} onChange={setStatus} disabled={busy} />
              </FormRow>
            </FormRowPair>

            <section className="chq-sponsor-block" aria-label="Package">
              <div className="chq-section-head">
                <span className="chq-section-label">Package</span>
              </div>
              {d.slots.length === 0 ? (
                <p className="chq-sponsor-block-empty">Nothing in this package yet. Give the sponsor a tier, or an extra below.</p>
              ) : (
                <ul className="chq-sponsor-slots">
                  {d.slots.map((slot, i) => {
                    const mark = slotMark(slot);
                    return (
                      <li className="chq-sponsor-slot" key={`${slot.entitlementId}-${i}`}>
                        <span className="chq-sponsor-slot-main">
                          <span className="chq-sponsor-slot-name">
                            {slotLabel(slot)}
                            {slot.extra ? <span className="chq-sponsor-slot-extra">· extra</span> : null}
                          </span>
                          <span className="chq-sponsor-slot-sub">
                            {slot.session
                              ? `${slot.session.title || 'Untitled session'} · ${SLOT_STATUS_WORDS[slot.session.status].toLowerCase()}`
                              : 'Not started'}
                          </span>
                        </span>
                        <span className={mark === 'Free' ? 'chq-sponsor-slot-mark' : 'chq-sponsor-slot-mark chq-sponsor-slot-mark-held'}>
                          {mark}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {d.over.length > 0 ? (
                <div className="chq-tier-over" role="status">
                  <span className="chq-tier-over-label">Over the allowance</span>
                  <ul className="chq-tier-over-list">
                    {d.over.map((o) => (
                      <li key={o.id}>
                        {`${o.title || 'Untitled session'} (${SLOT_STATUS_WORDS[o.status].toLowerCase()})`}
                      </li>
                    ))}
                  </ul>
                  <span className="chq-tier-over-note">
                    The tier was lowered after these were made. They keep their place; add an extra below to give them a slot.
                  </span>
                </div>
              ) : null}
            </section>

            <section className="chq-sponsor-block" aria-label="Extras">
              <div className="chq-section-head">
                <span className="chq-section-label">{tierName ? `Extras on top of ${tierName}` : 'Extras'}</span>
              </div>
              {extras.length === 0 ? <p className="chq-sponsor-block-empty">{`Only what the tier gives. Add a session type for one more just for ${companyName}.`}</p> : null}
              <EntitlementRows idPrefix="extras" rows={extras} formats={formats} onChange={setExtras} disabled={busy} />
            </section>

            <section className="chq-sponsor-block" aria-label="Contacts">
              <div className="chq-section-head">
                <span className="chq-section-label">Contacts</span>
                {!adding ? (
                  <button type="button" className="chq-link-button chq-sponsorships-add" onClick={() => setAdding(true)} disabled={busy}>
                    Add contact
                  </button>
                ) : null}
              </div>
              {contactError ? (
                <div className="chq-error" role="alert">
                  {contactError}
                </div>
              ) : null}
              {contactNote ? (
                <p className="chq-sponsor-block-note" role="status">
                  {contactNote}
                </p>
              ) : null}
              {d.contacts.length === 0 ? (
                <p className="chq-sponsor-block-empty">No contacts yet. A contact is who gets the sponsor's portal and the decisions on its sessions.</p>
              ) : (
                <ul className="chq-sponsor-contacts">
                  {d.contacts.map((c) => (
                    <li className="chq-sponsor-contact" key={c.id}>
                      <span className="chq-sponsor-contact-main">
                        <span className="chq-sponsor-contact-name">
                          {c.name}
                          {c.isPrimary ? <span className="chq-flag">Primary</span> : null}
                        </span>
                        <span className="chq-sponsor-contact-sub">
                          {c.email} · {contactLine(c)}
                        </span>
                      </span>
                      {c.isPrimary ? null : (
                        <button
                          type="button"
                          className="chq-link-button chq-sponsor-contact-remove"
                          aria-label={`Remove ${c.name}`}
                          onClick={() => setPendingRemove(c)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {adding ? (
                <div className="chq-sponsor-add-contact">
                  <FormRowPair>
                    <FormRow label="First name" htmlFor="contact-first">
                      <input
                        id="contact-first"
                        className="chq-input"
                        value={first}
                        maxLength={MAX_PERSON_NAME}
                        onChange={(e) => setFirst(e.target.value)}
                        disabled={contactBusy}
                      />
                    </FormRow>
                    <FormRow label="Last name" htmlFor="contact-last" optional>
                      <input
                        id="contact-last"
                        className="chq-input"
                        value={last}
                        maxLength={MAX_PERSON_NAME}
                        onChange={(e) => setLast(e.target.value)}
                        disabled={contactBusy}
                      />
                    </FormRow>
                  </FormRowPair>
                  <FormRow label="Email" htmlFor="contact-email">
                    <input
                      id="contact-email"
                      className="chq-input"
                      type="email"
                      value={email}
                      maxLength={MAX_EMAIL_LENGTH}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={contactBusy}
                    />
                  </FormRow>
                  <label className="chq-checkbox-label">
                    <input type="checkbox" className="chq-check" checked={primary} onChange={(e) => setPrimary(e.target.checked)} disabled={contactBusy} />
                    Make them the primary contact
                  </label>
                  <div className="chq-sponsor-add-actions">
                    <button type="button" className="chq-btn chq-btn-secondary" onClick={(e) => void addContact(e)} disabled={contactBusy}>
                      {contactBusy ? 'Adding…' : 'Add contact'}
                    </button>
                    <button
                      type="button"
                      className="chq-btn chq-btn-tertiary"
                      onClick={() => {
                        setAdding(false);
                        setContactError(null);
                      }}
                      disabled={contactBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </ModalFrame>
      {pendingRemove ? (
        <ConfirmDialog
          title={`Remove ${pendingRemove.name} from ${companyName}?`}
          body="They lose this sponsor's section in their portal. Their person record stays."
          confirmLabel="Remove contact"
          pending={contactBusy}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setPendingRemove(null)}
        />
      ) : null}
    </>
  );
}
