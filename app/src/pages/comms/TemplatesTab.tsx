import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { COMPOSE_MERGE_FIELDS, type MergeField } from '../../lib/merge-fields';
import { InsertFieldMenu } from './InsertFieldMenu';
import { DelayedLoading } from '../../components/DelayedLoading';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../lib/dates';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { EmailTemplate } from './types';
import { DEC_993, DEC_621 } from '../../../../src/decisions';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_RICH_TEXT_LENGTH } from '../../lib/text-caps';
import './templates.css';

void DEC_993;
void DEC_621;

interface DraftTemplate {
  name: string;
  subject: string;
  bodyText: string;
}

const BLANK_DRAFT: DraftTemplate = { name: '', subject: '', bodyText: '' };

// DEC-890 (amendment wave 4): a row's first line is purpose copy, not the
// subject line. EmailTemplate carries no stored purpose/description column
// and templates have no `kind` field either (src/db/schema/email.ts), so
// this derives a purpose line from the template's own NAME via generic
// keyword matching against the kind of communication it names (accepted /
// declined / scheduled / reminder / logistics / portal invite). That keeps
// the mapping generic — it works for any organizer's own template names,
// not just the ones scripts/seed-lib.ts happens to ship — and falls back to
// a neutral line when no keyword matches.
function derivePurpose(t: EmailTemplate): string {
  const n = t.name.toLowerCase();
  if (/declin|reject|waitlist/.test(n)) return 'Used for declined submissions';
  if (/accept/.test(n)) return 'Used for accepted submissions';
  if (/schedul/.test(n)) return 'Used to confirm a scheduled session';
  if (/remind/.test(n)) return 'Used to remind speakers of open tasks';
  if (/logistic/.test(n)) return 'Used to share final event logistics';
  if (/portal|invit/.test(n)) return 'Used to invite a speaker to their portal';
  return 'Custom template';
}

export function TemplatesTab({ eventId, onBack }: { eventId: string; onBack?: () => void }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftTemplate>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  // DEC-941: deleting a template is irreversible, so it's gated behind the
  // shared ConfirmDialog rather than firing on click.
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  // DEC-856 (wave-13 amendment): POST/PATCH /templates both throw
  // {name,subject,bodyText}-keyed "Validation failed" refusals -- kept WHOLE
  // and keyed by the server's own wire keys, cleared at the start of every
  // save attempt, never collapsed to the shared top-level banner.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    setError(null);
    apiList<EmailTemplate>(`/events/${eventId}/templates`)
      .then((res) => setTemplates(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load templates'))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function startNew() {
    setEditingId('new');
    setDraft(BLANK_DRAFT);
    setFieldErrors({});
  }

  function startEdit(t: EmailTemplate) {
    setEditingId(t.id);
    setDraft({ name: t.name, subject: t.subject, bodyText: t.bodyText });
    setFieldErrors({});
  }

  // DEC-890 (amendment wave 4): opening Templates preselects the first
  // template so the right pane is never an empty box. Only fires once the
  // list has loaded and nothing is already selected/being created, so it
  // never fights a user who is mid-edit or mid-"New template".
  useEffect(() => {
    const first = templates[0];
    if (loaded && editingId === null && first) {
      startEdit(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, templates, editingId]);

  const selectedTemplate = editingId && editingId !== 'new' ? templates.find((t) => t.id === editingId) ?? null : null;

  async function save() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      if (editingId === 'new') {
        await apiPost(`/events/${eventId}/templates`, draft);
      } else if (editingId) {
        await apiPatch(`/templates/${editingId}`, draft);
      }
      setEditingId(null);
      load();
    } catch (err) {
      // DEC-856 (wave-13 amendment): a fields-bearing refusal renders AT its
      // own control, never collapsed to the shared top-level banner -- a
      // field-less refusal (not found, unauthorized) still falls through to
      // the verbatim `error` banner exactly as before.
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save template');
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    setError(null);
    setDeleting(true);
    try {
      await apiDelete(`/templates/${pendingDelete.id}`);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  }

  // DEC-890 (3): duplicates the row's own stored text, never a re-fetch --
  // the list projection already carries subject/bodyText. ' (copy)' is
  // always appended, even if it makes the name collide with another copy;
  // templates have no uniqueness constraint on name.
  async function duplicate(t: EmailTemplate) {
    setError(null);
    try {
      await apiPost(`/events/${eventId}/templates`, {
        name: `${t.name} (copy)`,
        subject: t.subject,
        bodyText: t.bodyText,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to duplicate template');
    }
  }

  function useInSend(t: EmailTemplate) {
    navigate(`/comms?tab=compose&template=${t.id}`);
  }

  // DEC-793 idiom, DEC-993 control: inserts at the body textarea's current
  // caret (not appended blindly) and restores focus + caret after insert.
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingCaretRef.current !== null && bodyRef.current) {
      const pos = pendingCaretRef.current;
      bodyRef.current.focus();
      bodyRef.current.setSelectionRange(pos, pos);
      pendingCaretRef.current = null;
    }
  }, [draft.bodyText]);

  function insertChip(field: MergeField) {
    const token = `{${field}}`;
    const el = bodyRef.current;
    const start = el?.selectionStart ?? draft.bodyText.length;
    const end = el?.selectionEnd ?? draft.bodyText.length;
    pendingCaretRef.current = start + token.length;
    setDraft((d) => ({ ...d, bodyText: d.bodyText.slice(0, start) + token + d.bodyText.slice(end) }));
  }

  return (
    <div className="chq-comms-templates-tab" {...(editingId ? { 'data-chq-phone-dock': true } : {})}>
      {/* v12 phone frame "Templates · 390" (docs/design/Chautauqua
          Comms.dc.html:286): the drill head is the shell's own
          .chq-phone-head/-head-drill vocabulary (styles.css:2190, :2209),
          composed onto this page-local head rather than replacing it --
          the page-local classes stay so TemplatesTab.render.test.tsx and
          Comms.phone.render.test.tsx keep reading them unchanged. */}
      <div className="chq-comms-templates-head chq-phone-head chq-phone-head-drill">
        <div className="chq-comms-templates-titles">
          <button
            type="button"
            className="chq-link-button chq-comms-templates-breadcrumb chq-phone-back"
            onClick={() => {
              // w7-d: the phone drill also has to leave the drilled
              // state Comms.tsx owns, not just change the tab.
              onBack?.();
              navigate('/comms?tab=compose');
            }}
          >
            &lsaquo; Comms
          </button>
          <h1 className="chq-page-title">Templates</h1>
          {/* DEC-621 (wave-98 amendment): a third line inside the phone
              drill head band -- docs/design/Chautauqua Comms.dc.html:290
              draws `5 saved` directly under the H1. Phone-only copy (the
              desktop pin at Comms.dc.html:227-229 carries no count line,
              and `.chq-section-head`'s own `Saved · {templates.length}`
              line below stays exactly where it is at every width) --
              hidden by default, shown only inside templates.css's terminal
              max-width:700px block. Sourced from the same `templates`
              array the section head already reads, never a second fetch. */}
          <span className="chq-comms-templates-head-count">{templates.length} saved</span>
        </div>
        <button type="button" className="chq-btn chq-btn-primary" onClick={startNew}>
          New template
        </button>
      </div>

      {error && <div className="chq-error-banner">{error}</div>}
      {loading && <DelayedLoading label="Loading templates…" />}

      <div className="chq-comms-templates">
        <section>
          <div className="chq-section-head">
            <span className="chq-section-label">Saved &middot; {templates.length}</span>
          </div>
          {/* B7 rule 6 (DEC-678): Templates has no facet (no search, no
              filter), so a settled empty list is always the 'fresh' voice —
              never the live headers over an empty body. The header's own
              'New template' button stays the collection's one primary, so
              this EmptyState carries no action of its own. */}
          {loaded && !loading && templates.length === 0 ? (
            <EmptyState variant="fresh" what="No templates yet." action={null} />
          ) : (
            <table className="chq-table chq-comms-templates-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="chq-comms-templates-col-last-used">Last used</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className={t.id === editingId ? 'chq-comms-template-row-selected' : undefined}>
                    {/* DEC-890 amendment (wave 18): the row carries no verbs
                        of its own -- the NAME is the row's one control,
                        selecting the template into the editor where Delete,
                        Duplicate and "Use in a send" live. Purpose copy +
                        subject stay demoted secondary meta. The phone-only
                        "Open" span below (DEC-937 wave-111 amendment) is
                        the frame's chip rendered as inert decoration --
                        aria-hidden, no handler, no role -- so the row still
                        has exactly one control; it just visually echoes the
                        frame's affordance rather than adding a second one. */}
                    <td data-label="Name">
                      <button type="button" className="chq-link-button chq-comms-template-name" onClick={() => startEdit(t)}>
                        {t.name}
                      </button>
                      <div className="chq-comms-template-detail">{derivePurpose(t)} &middot; {t.subject}</div>
                      <span className="chq-comms-template-open" aria-hidden="true">
                        Open
                      </span>
                    </td>
                    <td data-label="Last used" className="chq-comms-templates-col-last-used">
                      <span className="chq-comms-template-last-used">
                        {t.lastUsedAt ? `Last used ${formatDate(t.lastUsedAt)}` : 'Not used yet'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {editingId && (
          <section className="chq-comms-editor">
            {/* DEC-890 amendment (wave 4): the eyebrow IS the template's
                name, with Duplicate beside it -- renaming happens through
                the eyebrow, which makes a separate NAME input redundant for
                an existing template. "New template" has no name yet, so it
                keeps a Name field until the first Save gives it one. */}
            <div className="chq-comms-editor-head">
              <span className="chq-comms-editor-eyebrow">{editingId === 'new' ? 'New template' : selectedTemplate?.name}</span>
              {selectedTemplate && (
                <button type="button" className="chq-link-button" onClick={() => duplicate(selectedTemplate)}>
                  Duplicate
                </button>
              )}
            </div>
            {editingId === 'new' && (
              <label>
                <span className="chq-comms-editor-label">Name</span>
                <input
                  className="chq-input"
                  maxLength={MAX_NAME_LENGTH}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
                {fieldErrors.name && (
                  <p className="chq-field-error" role="alert">
                    {fieldErrors.name}
                  </p>
                )}
              </label>
            )}
            <label>
              <span className="chq-comms-editor-label">Subject</span>
              <input
                className="chq-input"
                maxLength={MAX_TEXT_LENGTH}
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              />
              {fieldErrors.subject && (
                <p className="chq-field-error" role="alert">
                  {fieldErrors.subject}
                </p>
              )}
            </label>
            <label>
              <span className="chq-comms-editor-label">Body</span>
              <textarea
                className="chq-textarea"
                rows={8}
                ref={bodyRef}
                maxLength={MAX_RICH_TEXT_LENGTH}
                value={draft.bodyText}
                onChange={(e) => setDraft((d) => ({ ...d, bodyText: e.target.value }))}
              />
              {fieldErrors.bodyText && (
                <p className="chq-field-error" role="alert">
                  {fieldErrors.bodyText}
                </p>
              )}
            </label>

            <div className="chq-comms-merge-chips">
              <InsertFieldMenu fields={COMPOSE_MERGE_FIELDS} onInsert={insertChip} />
            </div>

            {/* DEC-890 amendment (wave 4): footer is Save + "Use in a send".
                A brand-new, unsaved draft has no id to send with yet, so it
                gets Cancel (back to whatever was selected before "New
                template") in that one slot instead. */}
            {/* DEC-621 (wave-98 amendment): the frame's pinned Save/Cancel
                dock (docs/design/Chautauqua Comms.dc.html:323-324) is the
                shell's own `.chq-phone-dock` geometry (styles.css:2267),
                composed onto this EXISTING footer wrapper -- one Save
                control, one save() call (DEC-547), never a second button.
                `data-chq-phone-dock` on the page root above suppresses the
                shell's bottom tab bar while the editor is open
                (styles.css:430), so the frame's footer stays ONE region. */}
            <div className="chq-comms-editor-actions chq-phone-dock">
              <button type="button" className="chq-btn chq-btn-primary" disabled={saving} onClick={save}>
                Save
              </button>
              {selectedTemplate ? (
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => useInSend(selectedTemplate)}>
                  Use in a send
                </button>
              ) : (
                <button type="button" className="chq-btn chq-btn-secondary" disabled={saving} onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              )}
              {/* DEC-890 amendment (wave 18): Delete moves into the editor's
                  action row as a tertiary link -- never a bordered button
                  (DESIGN-RULINGS 3, 20) -- and only renders once there is a
                  saved template to delete; a never-saved 'new' draft has
                  nothing to delete. */}
              {selectedTemplate && (
                <button
                  type="button"
                  className="chq-link-button chq-comms-editor-delete"
                  onClick={() => setPendingDelete(selectedTemplate)}
                >
                  Delete
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this template?"
          body={`Sends already made keep their copy of "${pendingDelete.name}"'s text. This cannot be undone.`}
          confirmLabel="Delete template"
          pending={deleting}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
