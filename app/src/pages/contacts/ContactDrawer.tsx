import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { apiGet, apiPatch, apiUpload, ApiError } from '../../lib/api';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { formatDateTime } from '../../lib/dates';
import type { ContactDetail } from './types';
import { fromRows, toRows, travelValue, type CustomFieldRow } from './customFields';

interface Props {
  contactId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = 'submissions' | 'emails' | 'events';

export function ContactDrawer({ contactId, onClose, onSaved }: Props) {
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('submissions');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [bio, setBio] = useState('');
  const [travel, setTravel] = useState('');
  const [customFieldRows, setCustomFieldRows] = useState<CustomFieldRow[]>([]);

  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [website, setWebsite] = useState('');

  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [headshotUploading, setHeadshotUploading] = useState(false);
  const [headshotError, setHeadshotError] = useState<string | null>(null);
  const headshotInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGet<ContactDetail>(`/contacts/${contactId}`)
      .then((c) => {
        setContact(c);
        setFirstName(c.firstName);
        setLastName(c.lastName);
        setEmail(c.email);
        setCompany(c.company ?? '');
        setTitle(c.title ?? '');
        setPhone(c.phone ?? '');
        setNotes(c.notes ?? '');
        setBio(c.bio ?? '');
        setTravel(travelValue(c.customFields ?? {}));
        setCustomFieldRows(toRows(c.customFields ?? {}));
        setTwitter(c.socialLinks?.twitter ?? '');
        setLinkedin(c.socialLinks?.linkedin ?? '');
        setGithub(c.socialLinks?.github ?? '');
        setWebsite(c.socialLinks?.website ?? '');
        setHeadshotUrl(c.headshotUrl ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  async function save() {
    const result = fromRows(travel, customFieldRows);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const customFields = result.fields;
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/contacts/${contactId}`, {
        firstName,
        lastName,
        email,
        company: company || undefined,
        title: title || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
        bio: bio || undefined,
        customFields,
        socialLinks: { twitter, linkedin, github, website },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  }

  function updateRow(index: number, patch: Partial<CustomFieldRow>) {
    setCustomFieldRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setCustomFieldRows((rows) => rows.filter((_, i) => i !== index));
  }

  function addRow() {
    setCustomFieldRows((rows) => [...rows, { key: '', value: '' }]);
  }

  async function uploadHeadshot() {
    const file = headshotInputRef.current?.files?.[0];
    if (!file) return;
    setHeadshotUploading(true);
    setHeadshotError(null);
    try {
      const form = new FormData();
      form.set('headshot', file);
      const updated = await apiUpload<ContactDetail>(`/contacts/${contactId}/headshot`, form);
      setHeadshotUrl(updated.headshotUrl ?? null);
      if (headshotInputRef.current) headshotInputRef.current.value = '';
      onSaved();
    } catch (err) {
      setHeadshotError(err instanceof ApiError ? err.message : 'Failed to upload headshot');
    } finally {
      setHeadshotUploading(false);
    }
  }

  useEscapeKey(true, () => {
    if (!saving && !headshotUploading) onClose();
  });

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !saving && !headshotUploading) onClose();
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Contact detail" onClick={handleScrimClick}>
      <div className="chq-drawer chq-contacts-drawer">
        <div className="chq-contacts-drawer-head">
          {!loading && contact && (
            <div className="chq-contacts-drawer-heading">
              <span className="chq-contacts-drawer-name">
                {firstName} {lastName}
              </span>
              {(company || title) && (
                <span className="chq-meta">
                  {company}
                  {company && title ? ' · ' : ''}
                  {title}
                </span>
              )}
            </div>
          )}
          <button type="button" className="chq-btn-tertiary chq-drawer-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {loading && <p>Loading...</p>}
        {error && <div className="chq-error">{error}</div>}

        {!loading && contact && (
          <>
            <h2 className="chq-contacts-drawer-section-title">Contact detail</h2>

            <div className="chq-kv">
              <label className="chq-kv-row" htmlFor="chq-contact-first-name">
                <span className="chq-kv-label">First name</span>
                <input className="chq-input" id="chq-contact-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="chq-kv-row" htmlFor="chq-contact-last-name">
                <span className="chq-kv-label">Last name</span>
                <input className="chq-input" id="chq-contact-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className="chq-kv-row" htmlFor="chq-contact-email">
                <span className="chq-kv-label">Email</span>
                <input className="chq-input" id="chq-contact-email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="chq-kv-row" htmlFor="chq-contact-company">
                <span className="chq-kv-label">Company</span>
                <input className="chq-input" id="chq-contact-company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="chq-kv-row" htmlFor="chq-contact-title">
                <span className="chq-kv-label">Title</span>
                <input className="chq-input" id="chq-contact-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="chq-kv-row" htmlFor="chq-contact-phone">
                <span className="chq-kv-label">Phone</span>
                <input className="chq-input" id="chq-contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="chq-kv-row" htmlFor="chq-contact-notes">
                <span className="chq-kv-label">Notes</span>
                <textarea className="chq-textarea" id="chq-contact-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <label className="chq-kv-row" htmlFor="chq-contact-travel">
                <span className="chq-kv-label">Travel &amp; logistics</span>
                <textarea
                  className="chq-textarea"
                  id="chq-contact-travel"
                  rows={3}
                  placeholder='e.g. "Arrival May 11, aisle seat; dietary: Vegetarian"'
                  value={travel}
                  onChange={(e) => setTravel(e.target.value)}
                />
              </label>
            </div>

            <div className="chq-contacts-custom-fields" aria-label="Custom fields">
              <h3 className="chq-contacts-drawer-section-title">Custom fields</h3>
              {customFieldRows.map((row, index) => (
                <div className="chq-contacts-custom-field-row" key={index}>
                  <label htmlFor={`chq-contact-custom-field-key-${index}`}>
                    Key
                    <input
                      className="chq-input"
                      id={`chq-contact-custom-field-key-${index}`}
                      value={row.key}
                      onChange={(e) => updateRow(index, { key: e.target.value })}
                    />
                  </label>
                  <label htmlFor={`chq-contact-custom-field-value-${index}`}>
                    Value
                    <input
                      className="chq-input"
                      id={`chq-contact-custom-field-value-${index}`}
                      value={row.value}
                      onChange={(e) => updateRow(index, { value: e.target.value })}
                    />
                  </label>
                  <button type="button" className="chq-btn chq-btn-secondary" onClick={() => removeRow(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="chq-btn chq-btn-secondary" onClick={addRow}>
                Add field
              </button>
            </div>

            {/* CNT-10 (DEC-152/DEC-142/DEC-028): speaker profile section — bio,
                headshot, social links — kept visually separate from the CRM
                fields above since it round-trips through the same portal
                profile plumbing a speaker's own edits use. */}
            <section aria-label="Speaker profile" className="chq-contacts-profile-section">
              <h3 className="chq-contacts-drawer-section-title">Speaker profile</h3>

              <label htmlFor="chq-contact-bio">
                Bio
                <textarea className="chq-textarea" id="chq-contact-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
              </label>

              <div className="chq-contacts-headshot-field">
                {headshotUrl ? (
                  <img
                    className="chq-contacts-headshot"
                    src={headshotUrl}
                    alt={`${firstName} ${lastName} headshot`}
                    width={120}
                    height={120}
                  />
                ) : (
                  <p>No headshot uploaded yet.</p>
                )}
                <label htmlFor="chq-contact-headshot-upload">
                  Upload headshot
                  <input
                    id="chq-contact-headshot-upload"
                    className="chq-input"
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    ref={headshotInputRef}
                    onChange={uploadHeadshot}
                    disabled={headshotUploading}
                  />
                </label>
                {headshotUploading && <p>Uploading...</p>}
                {headshotError && <div className="chq-error">{headshotError}</div>}
              </div>

              <label htmlFor="chq-contact-twitter">
                Twitter
                <input className="chq-input" id="chq-contact-twitter" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
              </label>
              <label htmlFor="chq-contact-linkedin">
                LinkedIn
                <input className="chq-input" id="chq-contact-linkedin" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
              </label>
              <label htmlFor="chq-contact-github">
                GitHub
                <input className="chq-input" id="chq-contact-github" value={github} onChange={(e) => setGithub(e.target.value)} />
              </label>
              <label htmlFor="chq-contact-website">
                Website
                <input className="chq-input" id="chq-contact-website" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </section>

            <button type="button" className="chq-btn chq-btn-primary" disabled={saving} onClick={save}>
              Save
            </button>

            <div className="chq-chipstrip chq-contacts-drawer-tabs" role="tablist" aria-label="Contact history">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'submissions'}
                className={tab === 'submissions' ? 'chq-pill is-active' : 'chq-pill'}
                onClick={() => setTab('submissions')}
              >
                Submissions
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'emails'}
                className={tab === 'emails' ? 'chq-pill is-active' : 'chq-pill'}
                onClick={() => setTab('emails')}
              >
                Emails
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'events'}
                className={tab === 'events' ? 'chq-pill is-active' : 'chq-pill'}
                onClick={() => setTab('events')}
              >
                Events
              </button>
            </div>

            {tab === 'submissions' && (
              <ul>
                {contact.history.submissions.map((s) => (
                  <li key={s.id}>
                    {s.ref} — {s.title} ({s.eventName}) — {s.status}
                  </li>
                ))}
                {contact.history.submissions.length === 0 && <li>No submissions.</li>}
              </ul>
            )}
            {tab === 'emails' && (
              <ul>
                {contact.history.emails.map((e) => (
                  <li key={e.id}>
                    {formatDateTime(e.sentAt)} — {e.subject} ({e.toEmail})
                  </li>
                ))}
                {contact.history.emails.length === 0 && <li>No emails.</li>}
              </ul>
            )}
            {tab === 'events' && (
              <ul>
                {contact.history.events.map((name) => (
                  <li key={name}>{name}</li>
                ))}
                {contact.history.events.length === 0 && <li>No events.</li>}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
