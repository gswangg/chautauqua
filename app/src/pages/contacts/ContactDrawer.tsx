import { useEffect, useState } from 'react';
import { apiGet, apiPatch, ApiError } from '../../lib/api';
import type { ContactDetail } from './types';

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
  const [customFieldsText, setCustomFieldsText] = useState('{}');

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
        setCustomFieldsText(JSON.stringify(c.customFields ?? {}, null, 2));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  async function save() {
    let customFields: Record<string, string>;
    try {
      customFields = JSON.parse(customFieldsText);
    } catch {
      setError('Custom fields must be valid JSON.');
      return;
    }
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
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save contact');
    } finally {
      setSaving(false);
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
            {contact.headshotUrl && (
              <img className="chq-contact-headshot" src={contact.headshotUrl} alt={`${contact.firstName} ${contact.lastName} headshot`} width={120} height={120} />
            )}
            <label>
              First name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label>
              Last name
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Company
              <input value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>
              Notes
              <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <label>
              Bio
              <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
            </label>
            <label>
              Custom fields (JSON)
              <textarea rows={4} value={customFieldsText} onChange={(e) => setCustomFieldsText(e.target.value)} />
            </label>

            {contact.socialLinks && (
              <ul className="chq-contact-social-links">
                {contact.socialLinks.twitter && (
                  <li>
                    Twitter: <a href={contact.socialLinks.twitter}>{contact.socialLinks.twitter}</a>
                  </li>
                )}
                {contact.socialLinks.linkedin && (
                  <li>
                    LinkedIn: <a href={contact.socialLinks.linkedin}>{contact.socialLinks.linkedin}</a>
                  </li>
                )}
                {contact.socialLinks.github && (
                  <li>
                    GitHub: <a href={contact.socialLinks.github}>{contact.socialLinks.github}</a>
                  </li>
                )}
                {contact.socialLinks.website && (
                  <li>
                    Website: <a href={contact.socialLinks.website}>{contact.socialLinks.website}</a>
                  </li>
                )}
              </ul>
            )}

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
