import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiUpload, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/dates';
import type { ContactDetail, ContactListItem } from './types';
import { fromRows, toRows, travelValue, type CustomFieldRow } from './customFields';
import { contactLabels } from '../../../../src/domain/contact-labels';
import { BulkEmailModal } from './BulkEmailModal';
import { AddToEventModal } from './AddToEventModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ModalFrame } from '../../components/ModalFrame';

interface Props {
  contactId: string;
  onClose: () => void;
  onSaved: () => void;
  // DEC-574: distinct from onSaved — a headshot upload must refresh the
  // list's headshot thumbnail WITHOUT closing the drawer or discarding any
  // bio/notes/custom-field edits the speaker has typed but not yet saved.
  onContactChanged: () => void;
}

const EM_DASH = '—';

// A20 (w26-c): a field with no recorded value renders this literal string,
// in the same muted/disabled ink the rest of the record already uses for
// "no value" (chq-contacts-record-empty -> var(--chq-muted), no colour
// literal) — never an em dash and never a blank cell, so "blank" reads as a
// fact the record HAS (an empty value) rather than something missing.
const NOTHING_RECORDED = <span className="chq-contacts-record-empty">Nothing recorded</span>;

// A20 (w26-c): the drawer's four titled groups, each headed by the shared
// .chq-section-head/.chq-section-label treatment (2px ink rule, 11px/700
// uppercase label) every other section head in the app uses.
function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="chq-contacts-record-group">
      <div className="chq-section-head chq-contacts-record-group-head">
        <span className="chq-section-label">{title}</span>
      </div>
      {children}
    </div>
  );
}

// DEC-616: the drawer is a record, not a form. Every fact renders as plain
// text on a label/value row; clicking (or focusing) a value turns that ONE
// row into an input. Nothing is saved until the bottom action bar's Save is
// pressed — this mirrors the pre-existing save() semantics exactly, only
// the affordance changes.
function RecordRow({
  label,
  editing,
  onEdit,
  display,
  editor,
}: {
  label: string;
  editing: boolean;
  onEdit: () => void;
  display: ReactNode;
  editor: ReactNode;
}) {
  return (
    <div className="chq-contacts-record-row">
      <span className="chq-contacts-record-label">{label}</span>
      {editing ? (
        <div className="chq-contacts-record-editor">{editor}</div>
      ) : (
        <button type="button" className="chq-contacts-record-value" onClick={onEdit}>
          {display}
        </button>
      )}
    </div>
  );
}

interface HistoryRow {
  key: string;
  event: string;
  what: string;
}

function buildHistoryRows(history: ContactDetail['history']): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const s of history.submissions) {
    rows.push({ key: `sub-${s.id}`, event: s.eventName, what: `${s.title} (${s.ref}) — ${s.status}` });
  }
  for (const e of history.emails) {
    rows.push({ key: `email-${e.id}`, event: formatDateTime(e.sentAt), what: `${e.subject} → ${e.toEmail}` });
  }
  history.events.forEach((name, i) => {
    rows.push({ key: `event-${name}-${i}`, event: name, what: 'On roster' });
  });
  return rows;
}

export function ContactDrawer({ contactId, onClose, onSaved, onContactChanged }: Props) {
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [showAddToEvent, setShowAddToEvent] = useState(false);

  // DEC-758: delete refuses honestly — the confirm step's own inline error
  // (never the drawer-wide `error`) carries the server's 409 message plus a
  // link to the Duplicates tab, and stays open rather than closing the
  // drawer.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  // DEC-894: the drawer prints the stored file's filename and upload date
  // beside the image — an uploaded file with no metadata reads as
  // decoration, not as a record.
  const [headshotFile, setHeadshotFile] = useState<{ filename: string; uploadedAt: number } | null>(null);
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
        setHeadshotFile(c.headshotFile ?? null);
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

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete(`/contacts/${contactId}`);
      setShowDeleteConfirm(false);
      onSaved();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete contact');
    } finally {
      setDeleting(false);
    }
  }

  function updateRow(index: number, patch: Partial<CustomFieldRow>) {
    setCustomFieldRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setCustomFieldRows((rows) => rows.filter((_, i) => i !== index));
    setEditingField(null);
  }

  function addRow() {
    setCustomFieldRows((rows) => [...rows, { key: '', value: '' }]);
    setEditingField(`custom-${customFieldRows.length}`);
  }

  // DEC-894: downscale to a 512px longest edge via canvas/toBlob at 0.85
  // JPEG quality before POSTing — same numbers as the portal's inline
  // downscale script (src/routes/portal/profile.tsx HEADSHOT_DOWNSCALE_JS).
  // Leaves the original file in place if the browser cannot do it (no
  // canvas/Image support, decode failure, etc.) — the server-side dimension
  // gate is the sole authority in that case.
  async function downscaleHeadshot(file: File): Promise<File> {
    try {
      const MAX_EDGE = 512;
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      if (width <= MAX_EDGE && height <= MAX_EDGE) return file;
      const scale = MAX_EDGE / Math.max(width, height);
      const targetW = Math.round(width * scale);
      const targetH = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) return file;
      const base = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
    } catch {
      return file;
    }
  }

  async function uploadHeadshot() {
    const chosen = headshotInputRef.current?.files?.[0];
    if (!chosen) return;
    setHeadshotUploading(true);
    setHeadshotError(null);
    try {
      const file = await downscaleHeadshot(chosen);
      const form = new FormData();
      form.set('headshot', file);
      const updated = await apiUpload<ContactDetail>(`/contacts/${contactId}/headshot`, form);
      setHeadshotUrl(updated.headshotUrl ?? null);
      setHeadshotFile(updated.headshotFile ?? null);
      if (headshotInputRef.current) headshotInputRef.current.value = '';
      // DEC-574: refresh the list's thumbnail without closing this drawer —
      // onSaved() closes on save-and-navigate-away, which would discard any
      // bio/notes/custom-field edits typed but not yet saved.
      onContactChanged();
    } catch (err) {
      setHeadshotError(err instanceof ApiError ? err.message : 'Failed to upload headshot');
    } finally {
      setHeadshotUploading(false);
    }
  }

  const nestedModalOpen = showEmail || showAddToEvent || showDeleteConfirm;
  const closeDisabled = saving || headshotUploading || nestedModalOpen;

  const historyRows = contact ? buildHistoryRows(contact.history) : [];

  const contactListItem: ContactListItem = {
    id: contactId,
    firstName,
    lastName,
    email,
    company: company || undefined,
    title: title || undefined,
    // This drawer-local projection only feeds AddToEventModal (which
    // doesn't render labels) — never the directory table itself.
    labels: [],
  };

  function textField(
    key: string,
    label: string,
    value: string,
    setValue: (v: string) => void,
    opts: { multiline?: boolean; type?: string; placeholder?: string } = {},
  ) {
    const editing = editingField === key;
    const placeholder = opts.placeholder ?? 'Not set';
    return (
      <RecordRow
        key={key}
        label={label}
        editing={editing}
        onEdit={() => setEditingField(key)}
        display={value || NOTHING_RECORDED}
        editor={
          opts.multiline ? (
            <textarea
              className="chq-textarea"
              autoFocus
              rows={4}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setEditingField(null)}
              placeholder={placeholder}
            />
          ) : (
            <input
              className="chq-input"
              autoFocus
              type={opts.type ?? 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setEditingField(null)}
              placeholder={placeholder}
            />
          )
        }
      />
    );
  }

  const drawerTitle = !loading && contact ? `${firstName} ${lastName}`.trim() || 'Contact' : 'Contact';
  const drawerSubtitle =
    !loading && contact ? (
      company || title ? (
        <>
          {company}
          {company && title ? ' · ' : ''}
          {title}
        </>
      ) : (
        EM_DASH
      )
    ) : undefined;

  // A20 (w26-c): the Labels row — a read-only view of the same Labels the
  // directory table's chips show (DEC-738/DEC-726: contactLabels over this
  // contact's customFields, travel key excluded). The editable custom-field
  // rows are unaffected.
  const labelsNode = contact ? (
    <div className="chq-contacts-record-row" key="labels">
      <span className="chq-contacts-record-label">Labels</span>
      <div className="chq-contacts-record-value chq-contacts-record-readonly">
        {contactLabels(contact.customFields ?? {}).length > 0 ? (
          <ul className="chq-contacts-label-chips">
            {contactLabels(contact.customFields ?? {}).map((label) => (
              <li key={label} className="chq-contacts-label-chip">
                {label}
              </li>
            ))}
          </ul>
        ) : (
          NOTHING_RECORDED
        )}
      </div>
    </div>
  ) : null;

  const headshotNode = contact ? (
    <div className="chq-contacts-record-row" key="headshot">
      <span className="chq-contacts-record-label">Headshot</span>
      <div className="chq-contacts-record-editor chq-contacts-headshot-field">
        {headshotUrl ? (
          <img
            className="chq-contacts-headshot"
            src={headshotUrl}
            alt={`${firstName} ${lastName} headshot`}
            width={64}
            height={64}
          />
        ) : (
          NOTHING_RECORDED
        )}
        {headshotFile && (
          <p className="chq-contacts-headshot-meta">
            {headshotFile.filename} — uploaded {formatDateTime(headshotFile.uploadedAt)}
          </p>
        )}
        <label className="chq-contacts-headshot-upload" htmlFor="chq-contact-headshot-upload">
          Upload headshot
          <input
            id="chq-contact-headshot-upload"
            className="chq-file"
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            ref={headshotInputRef}
            onChange={uploadHeadshot}
            disabled={headshotUploading}
            placeholder="headshot.jpg"
          />
        </label>
        {headshotUploading && <p>Uploading...</p>}
        {headshotError && <div className="chq-error">{headshotError}</div>}
      </div>
    </div>
  ) : null;

  // A20 (w26-c): the four social links collapse into ONE 'Links' row — never
  // four separate rows. Editing opens all four inputs at once; only the
  // LAST input's blur closes the row (same convention custom-field rows
  // already use for their key/value pair), so tabbing between the four
  // fields doesn't prematurely exit edit mode. PATCH payload is unchanged:
  // socialLinks: { twitter, linkedin, github, website }.
  const linksEditing = editingField === 'links';
  // Each populated value renders as its OWN element (never concatenated
  // into one string) so an individual link value stays independently
  // findable in the DOM — the row is one grid row, not one text blob.
  const linksValues = [twitter, linkedin, github, website].filter((v) => v.trim() !== '');
  const linksSummary: ReactNode[] = linksValues.flatMap((v, i) =>
    i === 0 ? [<span key={v}>{v}</span>] : [' · ', <span key={v}>{v}</span>],
  );
  const linksNode = contact ? (
    <div className="chq-contacts-record-row" key="links">
      <span className="chq-contacts-record-label">Links</span>
      {linksEditing ? (
        <div className="chq-contacts-record-editor chq-contacts-links-editor">
          <label className="chq-contacts-links-field">
            <span className="chq-contacts-links-field-label">Twitter</span>
            <input className="chq-input" autoFocus value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
          </label>
          <label className="chq-contacts-links-field">
            <span className="chq-contacts-links-field-label">LinkedIn</span>
            <input className="chq-input" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="in/handle" />
          </label>
          <label className="chq-contacts-links-field">
            <span className="chq-contacts-links-field-label">GitHub</span>
            <input className="chq-input" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="handle" />
          </label>
          <label className="chq-contacts-links-field">
            <span className="chq-contacts-links-field-label">Website</span>
            <input
              className="chq-input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onBlur={() => setEditingField(null)}
              placeholder="https://example.com"
            />
          </label>
        </div>
      ) : (
        <button type="button" className="chq-contacts-record-value" onClick={() => setEditingField('links')}>
          {linksSummary.length > 0 ? linksSummary : NOTHING_RECORDED}
        </button>
      )}
    </div>
  ) : null;

  const customFieldNodes = customFieldRows.map((row, index) => {
    const key = `custom-${index}`;
    const editing = editingField === key;
    return (
      <div className="chq-contacts-record-row" key={key}>
        <span className="chq-contacts-record-label">
          {editing ? (
            <input
              className="chq-input"
              aria-label={`Custom field ${index + 1} key`}
              value={row.key}
              onChange={(e) => updateRow(index, { key: e.target.value })}
              placeholder="T-shirt size"
            />
          ) : (
            row.key || NOTHING_RECORDED
          )}
        </span>
        {editing ? (
          <div className="chq-contacts-record-editor">
            <input
              className="chq-input"
              aria-label={`Custom field ${index + 1} value`}
              value={row.value}
              onChange={(e) => updateRow(index, { value: e.target.value })}
              onBlur={() => setEditingField(null)}
              placeholder="Large"
            />
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => removeRow(index)}>
              Remove
            </button>
          </div>
        ) : (
          <button type="button" className="chq-contacts-record-value" onClick={() => setEditingField(key)}>
            {row.value || NOTHING_RECORDED}
          </button>
        )}
      </div>
    );
  });

  return (
    <>
      <ModalFrame
        title={drawerTitle}
        subtitle={drawerSubtitle}
        ariaLabel="Contact detail"
        onClose={onClose}
        closeDisabled={closeDisabled}
        modalClassName="chq-drawer chq-contacts-drawer"
      >
        {loading && <DelayedLoading />}
        {error && <div className="chq-error">{error}</div>}

        {!loading && contact && (
          <>
            <div className="chq-contacts-record">
              {/* DEC-616 amendment (wave 15): the drawer states its own save
                  mechanism in the record head, in plain words, rather than
                  leaving Save's persistent footer (below) to speak for
                  itself. */}
              <p className="chq-meta chq-contacts-record-save-caption">
                Click a row to edit it — nothing is saved until you press Save.
              </p>

              {/* A20 (w26-c): four titled groups, in this order — Contact,
                  Profile, This event, Notes. Every field renders (no
                  hide-when-empty disclosure): a blank field prints "Nothing
                  recorded" so blank is distinguishable from missing. */}
              <FieldGroup title="Contact">
                {textField('firstName', 'First name', firstName, setFirstName, { placeholder: 'Priya' })}
                {textField('lastName', 'Last name', lastName, setLastName, { placeholder: 'Raman' })}
                {textField('email', 'Email', email, setEmail, { type: 'email', placeholder: 'priya.raman@example.com' })}
                {textField('phone', 'Phone', phone, setPhone, { placeholder: '+1 555 010 1234' })}
                {textField('company', 'Company', company, setCompany, { placeholder: 'Latticework Systems' })}
                {textField('title', 'Title', title, setTitle, { placeholder: 'Principal Engineer' })}
              </FieldGroup>

              <FieldGroup title="Profile">
                {textField('bio', 'Bio', bio, setBio, { multiline: true, placeholder: 'A short speaker bio' })}
                {headshotNode}
                {linksNode}
              </FieldGroup>

              <FieldGroup title="This event">
                {labelsNode}
                {/* DEC-616 amendment (wave 4): the reserved travel custom
                    field is labelled DIETARY — the word the frame and the
                    speaker-facing form use — even though its storage key
                    stays `travel_logistics`. */}
                {textField('travel', 'Dietary', travel, setTravel, {
                  multiline: true,
                  placeholder: 'Flight details, hotel, dietary needs...',
                })}
                {customFieldNodes}
                <button type="button" className="chq-btn chq-btn-secondary chq-contacts-add-field" onClick={addRow}>
                  Add field
                </button>
              </FieldGroup>

              <FieldGroup title="Notes">
                {textField('notes', 'Notes', notes, setNotes, { multiline: true, placeholder: 'Internal notes about this contact' })}
              </FieldGroup>
            </div>

            <section aria-label="Across your events" className="chq-contacts-history">
              <h3 className="chq-contacts-drawer-section-title">Across your events</h3>
              {historyRows.length === 0 && <p className="chq-meta">No history yet.</p>}
              {contact.history.submissionsTotal > contact.history.submissions.length && (
                <p className="chq-meta">
                  Showing {contact.history.submissions.length} of {contact.history.submissionsTotal} submissions
                </p>
              )}
              {historyRows.map((row) => (
                <div className="chq-contacts-history-row" key={row.key}>
                  <span className="chq-contacts-history-event">{row.event}</span>
                  <span className="chq-contacts-history-what">{row.what}</span>
                </div>
              ))}
            </section>

            {/* A20 (w26-c): 'Delete this contact' sits far left as a
                tertiary link; Cancel and Save are right-flushed in their own
                group — Delete is never adjacent to Save. */}
            <div className="chq-contacts-drawer-actions">
              <button
                type="button"
                className="chq-btn-tertiary chq-contacts-delete-trigger"
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteConfirm(true);
                }}
              >
                Delete this contact
              </button>
              <div className="chq-contacts-drawer-actions-right">
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setShowEmail(true)}>
                  Email
                </button>
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setShowAddToEvent(true)}>
                  Add to event
                </button>
                <button type="button" className="chq-btn chq-btn-secondary" disabled={closeDisabled} onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="chq-btn chq-btn-primary" disabled={saving} onClick={save}>
                  Save
                </button>
              </div>
            </div>
          </>
        )}
      </ModalFrame>

      {showEmail && <BulkEmailModal contactIds={[contactId]} eventId={null} onClose={() => setShowEmail(false)} />}
      {showAddToEvent && <AddToEventModal contact={contactListItem} onClose={() => setShowAddToEvent(false)} />}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete this contact"
          body={
            deleteError ? (
              <>
                <p>{deleteError}</p>
                <p>
                  <Link to="/contacts?tab=duplicates">Go to the Duplicates tab</Link> to merge this record instead.
                </p>
              </>
            ) : (
              `Delete ${firstName} ${lastName}? Any task assignments and sourcing-pipeline history for this person are removed with them. This cannot be undone.`
            )
          }
          confirmLabel="Delete"
          destructive
          pending={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
