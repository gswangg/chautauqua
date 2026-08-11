import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPatch, apiUpload, ApiError } from '../../lib/api';
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

  return (
    <div className="chq-drawer-backdrop" role="dialog" aria-label="Contact detail">
      <div className="chq-drawer">
        <button type="button" className="chq-drawer-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {loading && <p>Loading...</p>}
        {error && <div className="chq-error-banner">{error}</div>}

        {!loading && contact && (
          <>
            <h2>Contact detail</h2>

            <label htmlFor="chq-contact-first-name">
              First name
              <input id="chq-contact-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label htmlFor="chq-contact-last-name">
              Last name
              <input id="chq-contact-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label htmlFor="chq-contact-email">
              Email
              <input id="chq-contact-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label htmlFor="chq-contact-company">
              Company
              <input id="chq-contact-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>
            <label htmlFor="chq-contact-title">
              Title
              <input id="chq-contact-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label htmlFor="chq-contact-phone">
              Phone
              <input id="chq-contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label htmlFor="chq-contact-notes">
              Notes
              <textarea id="chq-contact-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <label htmlFor="chq-contact-travel">
              Travel &amp; logistics
              <textarea
                id="chq-contact-travel"
                rows={3}
                placeholder='e.g. "Arrival May 11, aisle seat; dietary: Vegetarian"'
                value={travel}
                onChange={(e) => setTravel(e.target.value)}
              />
            </label>

            <div className="chq-contact-custom-fields" aria-label="Custom fields">
              <h3>Custom fields</h3>
              {customFieldRows.map((row, index) => (
                <div className="chq-contact-custom-field-row" key={index}>
                  <label htmlFor={`chq-contact-custom-field-key-${index}`}>
                    Key
                    <input
                      id={`chq-contact-custom-field-key-${index}`}
                      value={row.key}
                      onChange={(e) => updateRow(index, { key: e.target.value })}
                    />
                  </label>
                  <label htmlFor={`chq-contact-custom-field-value-${index}`}>
                    Value
                    <input
                      id={`chq-contact-custom-field-value-${index}`}
                      value={row.value}
                      onChange={(e) => updateRow(index, { value: e.target.value })}
                    />
                  </label>
                  <button type="button" onClick={() => removeRow(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={addRow}>
                Add field
              </button>
            </div>

            {/* CNT-10 (DEC-152/DEC-142/DEC-028): speaker profile section — bio,
                headshot, social links — kept visually separate from the CRM
                fields above since it round-trips through the same portal
                profile plumbing a speaker's own edits use. */}
            <section aria-label="Speaker profile" className="chq-contact-profile-section">
              <h3>Speaker profile</h3>

              <label htmlFor="chq-contact-bio">
                Bio
                <textarea id="chq-contact-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
              </label>

              <div className="chq-contact-headshot-field">
                {headshotUrl ? (
                  <img
                    className="chq-contact-headshot"
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
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    ref={headshotInputRef}
                    onChange={uploadHeadshot}
                    disabled={headshotUploading}
                  />
                </label>
                {headshotUploading && <p>Uploading...</p>}
                {headshotError && <div className="chq-error-banner">{headshotError}</div>}
              </div>

              <label htmlFor="chq-contact-twitter">
                Twitter
                <input id="chq-contact-twitter" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
              </label>
              <label htmlFor="chq-contact-linkedin">
                LinkedIn
                <input id="chq-contact-linkedin" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
              </label>
              <label htmlFor="chq-contact-github">
                GitHub
                <input id="chq-contact-github" value={github} onChange={(e) => setGithub(e.target.value)} />
              </label>
              <label htmlFor="chq-contact-website">
                Website
                <input id="chq-contact-website" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </section>

            <button type="button" disabled={saving} onClick={save}>
              Save
            </button>

            <div className="chq-drawer-tabs">
              <button type="button" className={tab === 'submissions' ? 'chq-tab-active' : ''} onClick={() => setTab('submissions')}>
                Submissions
              </button>
              <button type="button" className={tab === 'emails' ? 'chq-tab-active' : ''} onClick={() => setTab('emails')}>
                Emails
              </button>
              <button type="button" className={tab === 'events' ? 'chq-tab-active' : ''} onClick={() => setTab('events')}>
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
                    {new Date(e.sentAt).toLocaleString()} — {e.subject} ({e.toEmail})
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
