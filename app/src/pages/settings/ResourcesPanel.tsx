// Resources (w4-h, DEC-047; folded into Speaker portal's read view w3-c,
// DEC-747): wiki page list/create/edit/delete plus file-resource upload.
// Rendered as a fragment (no own <section>/h2) inside PortalSettingsPanel's
// Resources row -- 'Add a resource' opens the shared ModalFrame with two
// exclusive kind chips (DEC-047 wave-64 amendment: File / Wiki page; only
// the selected kind's fields render, one primary submit carrying the verb).
// A wiki row's 'Replace' opens its inline edit form (title + content). A file row's
// 'Rename' opens the same inline form limited to the title input -- title
// and position are editable for any resource kind (DEC-029 amendment), but
// there is still no server endpoint that replaces a file's bytes, and
// DEC-733 says omit a control the store can't carry rather than render it
// disabled. A wiki resource's read row names the page and its SIZE (word
// count), never its raw markdown body (DEC-747).
//
// w1-f, DEC-785: this panel is only ever mounted inside its caller's own
// edit drill (PortalSettingsPanel), so at rest it must not ALSO dump
// straight into the full add/edit/delete surface -- it owns its own local
// summary/edit split. At rest it renders the real rows (name + kind, DEC-047
// amendment); 'Change' switches to the CRUD surface below rather than
// revealing it inline.
//
// DEC-815 amendment (wave 4): PortalSettingsPanel's own SummarySection row
// (before 'Change' is clicked) also needs the real resource rows instead
// of a describing sentence. `readOnly` makes this component serve both
// views rather than a second list renderer: the row-level `readOnly` render
// is the plain title + kind list (a file row also links its download,
// mirroring the CRUD view's own link) with no add/delete control at all;
// the default (unset) keeps the existing local summary/edit split used
// inside PortalSettingsPanel's own edit branch.
import { useEffect, useState, type FormEvent } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiDelete, apiList, apiPatch, apiPost, apiUpload, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { validateResourceForm, validateResourceTitleForm, type ResourceForm, type ResourceFormErrors } from './formState';
import { validateUpload, uploadHintText, allowedUploadExtensions } from '../../../../src/domain/files';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ModalFrame, FormRow } from '../../components/ModalFrame';
import { countOf } from '../../lib/plural';
import { MAX_NAME_LENGTH, MAX_RICH_TEXT_LENGTH } from '../../../../src/forms/validate';
import { MARKDOWN_SYNTAX_HINT } from '../../lib/markdown-hint';
import './settings-lists.css';

/** The two kinds the store can carry (DEC-733: no third 'link' chip -- the
 * frame's 'File/Link' is not a real store kind). */
type AddResourceKind = 'wiki' | 'file';

interface Resource {
  id: string;
  kind: string;
  title: string;
  content: string | null;
  fileId: string | null;
  position: number;
}

const EMPTY_FORM: ResourceForm = { title: '', content: '' };

function wordCount(text: string | null): number {
  const trimmed = (text ?? '').trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Read-row detail string: a wiki page's SIZE, never its body; a file's kind. */
function resourceDetail(resource: Resource): string {
  if (resource.kind === 'file') return 'File';
  return countOf(wordCount(resource.content), 'word');
}

export function ResourcesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { eventId } = useCurrentEvent();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  // DEC-047 wave-64 amendment: the add form is one modal with two exclusive
  // kinds -- only the selected kind's fields render.
  const [addingKind, setAddingKind] = useState<AddResourceKind>('wiki');
  const [newResource, setNewResource] = useState<ResourceForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<ResourceFormErrors>({});
  const [editing, setEditing] = useState<Record<string, ResourceForm>>({});
  const [fileTitle, setFileTitle] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  // DEC-941: deleting a resource is irreversible, so it's gated behind the
  // shared ConfirmDialog rather than firing on click.
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);
  const [deleting, setDeleting] = useState(false);
  // w1-f, DEC-785: local read/edit split -- defaults to the read-only list
  // (name + kind); 'Change' switches to the full CRUD surface below.
  const [showEditor, setShowEditor] = useState(false);

  function reload(id: string) {
    setLoading(true);
    apiList<Resource>(`/events/${id}/resources`)
      .then((res) => setResources(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load resources'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!eventId) return;
    reload(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function addResource(): Promise<boolean> {
    if (!eventId) return false;
    const errors = validateResourceForm(newResource);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return false;
    try {
      await apiPost(`/events/${eventId}/resources`, {
        title: newResource.title,
        content: newResource.content,
      });
      setNewResource(EMPTY_FORM);
      reload(eventId);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add resource');
      return false;
    }
  }

  async function uploadFileResource(): Promise<boolean> {
    if (!eventId) return false;
    if (fileTitle.trim().length === 0) {
      setFileError('Title is required');
      return false;
    }
    if (!fileToUpload) {
      setFileError('File is required');
      return false;
    }
    const check = validateUpload({ filename: fileToUpload.name, sizeBytes: fileToUpload.size, kind: 'handout' });
    if (!check.ok) {
      setFileError(`${check.message} ${uploadHintText('handout')} The typed Title is kept; nothing was uploaded.`);
      return false;
    }
    setFileError(undefined);
    const form = new FormData();
    form.set('title', fileTitle);
    form.set('file', fileToUpload);
    try {
      await apiUpload(`/events/${eventId}/resources`, form);
      setFileTitle('');
      setFileToUpload(null);
      reload(eventId);
      return true;
    } catch (err) {
      setFileError(err instanceof ApiError ? err.message : 'Failed to upload resource');
      return false;
    }
  }

  async function handleAddSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = addingKind === 'wiki' ? await addResource() : await uploadFileResource();
    if (ok) setAdding(false);
  }

  function startEdit(resource: Resource) {
    setEditing((prev) => ({
      ...prev,
      [resource.id]: { title: resource.title, content: resource.content ?? '' },
    }));
  }

  function cancelEdit(resource: Resource) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[resource.id];
      return next;
    });
  }

  async function saveEdit(resource: Resource) {
    if (!eventId) return;
    const form = editing[resource.id];
    if (!form) return;
    const isWiki = resource.kind === 'wiki';
    const errors = isWiki ? validateResourceForm(form) : validateResourceTitleForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    try {
      await apiPatch(`/resources/${resource.id}`, isWiki ? { title: form.title, content: form.content } : { title: form.title });
      cancelEdit(resource);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save resource');
    }
  }

  async function confirmDeleteResource() {
    if (!eventId || !pendingDelete) return;
    setDeleting(true);
    try {
      await apiDelete(`/resources/${pendingDelete.id}`);
      setPendingDelete(null);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete resource');
    } finally {
      setDeleting(false);
    }
  }

  if (readOnly) {
    return (
      <>
        {loading ? <DelayedLoading /> : null}
        {error ? <p role="alert">{error}</p> : null}
        <ul className="chq-settings-summary-list">
          {resources.map((resource) => (
            <li key={resource.id} className="chq-settings-summary-row">
              <span className="chq-settings-summary-row-primary">{resource.title}</span>
              <span className="chq-settings-summary-row-detail">
                {resource.kind === 'file' ? 'File' : 'Wiki page'}
                {resource.kind === 'file' && resource.fileId ? (
                  <>
                    {' · '}
                    <a className="chq-settings-inline-action" href={`/files/${resource.fileId}`}>
                      Download
                    </a>
                  </>
                ) : null}
              </span>
            </li>
          ))}
          {!loading && resources.length === 0 ? (
            <li className="chq-settings-summary-empty">No resources yet.</li>
          ) : null}
        </ul>
      </>
    );
  }

  if (!showEditor) {
    return (
      <div className="chq-settings-portal-resources-block">
        {loading ? <DelayedLoading /> : null}
        {error ? <p role="alert">{error}</p> : null}
        <ul className="chq-settings-summary-list">
          {resources.map((resource) => (
            <li key={resource.id} className="chq-settings-summary-row">
              <span className="chq-settings-summary-row-primary">{resource.title}</span>
              <span className="chq-settings-summary-row-detail">
                {resource.kind === 'file' ? 'File' : 'Wiki page'}
              </span>
            </li>
          ))}
          {!loading && resources.length === 0 ? (
            <li className="chq-settings-summary-empty">No resources yet.</li>
          ) : null}
        </ul>
        <button type="button" className="chq-link-button" onClick={() => setShowEditor(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="chq-settings-portal-resources-block">
      {loading ? <DelayedLoading /> : null}
      {error ? <p role="alert">{error}</p> : null}

      <button type="button" className="chq-link-button" onClick={() => setShowEditor(false)}>
        Back
      </button>

      <ul className="chq-settings-portal-resource-list">
        {resources.map((resource) => {
          const editForm = editing[resource.id];
          return (
            <li key={resource.id} className="chq-settings-portal-resource-row">
              {editForm ? (
                <div className="chq-settings-portal-resource-edit">
                  <input
                    className="chq-input"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [resource.id]: { ...editForm, title: e.target.value } }))
                    }
                    maxLength={MAX_NAME_LENGTH}
                  />
                  {resource.kind === 'wiki' ? (
                    <textarea
                      className="chq-textarea"
                      value={editForm.content}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [resource.id]: { ...editForm, content: e.target.value } }))
                      }
                      maxLength={MAX_RICH_TEXT_LENGTH}
                    />
                  ) : null}
                  {resource.kind === 'wiki' ? (
                    <span className="chq-settings-markdown-hint">{MARKDOWN_SYNTAX_HINT}</span>
                  ) : null}
                  {fieldErrors.title ? <span role="alert">{fieldErrors.title}</span> : null}
                  {resource.kind === 'wiki' && fieldErrors.content ? <span role="alert">{fieldErrors.content}</span> : null}
                  <button type="button" className="chq-btn chq-btn-primary" onClick={() => void saveEdit(resource)}>
                    Save
                  </button>
                  <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => cancelEdit(resource)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="chq-settings-portal-resource-name">{resource.title}</span>
                  <span className="chq-settings-portal-resource-detail">{resourceDetail(resource)}</span>
                  {resource.kind === 'file' && resource.fileId ? (
                    <a className="chq-settings-inline-action" href={`/files/${resource.fileId}`}>
                      Download
                    </a>
                  ) : null}
                  {resource.kind === 'wiki' ? (
                    <button type="button" className="chq-link-button" onClick={() => startEdit(resource)}>
                      Replace
                    </button>
                  ) : (
                    <button type="button" className="chq-link-button" onClick={() => startEdit(resource)}>
                      Rename
                    </button>
                  )}
                  <button type="button" className="chq-link-button" onClick={() => setPendingDelete(resource)}>
                    Delete
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" className="chq-settings-portal-add-resource" onClick={() => setAdding(true)}>
        Add a resource
      </button>

      {adding && (
        <ModalFrame
          as="form"
          onSubmit={handleAddSubmit}
          title="Add a resource"
          onClose={() => setAdding(false)}
          actions={
            <>
              <button type="submit" className="chq-btn chq-btn-primary">
                {addingKind === 'wiki' ? 'Add wiki page' : 'Upload file'}
              </button>
              <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </>
          }
        >
          <FormRow
            label="Title"
            htmlFor="resource-title"
            error={addingKind === 'wiki' ? fieldErrors.title : undefined}
          >
            <input
              id="resource-title"
              className="chq-input"
              placeholder="Title"
              value={addingKind === 'wiki' ? newResource.title : fileTitle}
              onChange={(e) =>
                addingKind === 'wiki'
                  ? setNewResource({ ...newResource, title: e.target.value })
                  : setFileTitle(e.target.value)
              }
              maxLength={MAX_NAME_LENGTH}
            />
          </FormRow>

          <div className="chq-form-row">
            <span className="chq-form-row-label" id="resource-kind-label">
              Kind
            </span>
            <div className="chq-form-row-control">
              <div className="chq-segmented" role="group" aria-label="Kind">
                <button
                  type="button"
                  className={addingKind === 'file' ? 'chq-btn chq-settings-kind-selected' : 'chq-btn chq-btn-secondary'}
                  aria-pressed={addingKind === 'file'}
                  onClick={() => setAddingKind('file')}
                >
                  File
                </button>
                <button
                  type="button"
                  className={addingKind === 'wiki' ? 'chq-btn chq-settings-kind-selected' : 'chq-btn chq-btn-secondary'}
                  aria-pressed={addingKind === 'wiki'}
                  onClick={() => setAddingKind('wiki')}
                >
                  Wiki page
                </button>
              </div>
            </div>
          </div>

          {addingKind === 'wiki' ? (
            <FormRow
              label="Content"
              htmlFor="resource-content"
              error={fieldErrors.content}
              help={<span className="chq-settings-markdown-hint">{MARKDOWN_SYNTAX_HINT}</span>}
            >
              <textarea
                id="resource-content"
                className="chq-textarea"
                placeholder="Content"
                value={newResource.content}
                onChange={(e) => setNewResource({ ...newResource, content: e.target.value })}
                maxLength={MAX_RICH_TEXT_LENGTH}
              />
            </FormRow>
          ) : (
            <FormRow
              label="File"
              htmlFor="resource-file"
              error={fileError}
              help={<span className="chq-upload-caps">{uploadHintText('handout')}</span>}
            >
              <input
                id="resource-file"
                className="chq-file"
                type="file"
                accept={allowedUploadExtensions('handout').map((e) => `.${e}`).join(',')}
                onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)}
              />
            </FormRow>
          )}
        </ModalFrame>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this resource?"
          body={`Speakers lose the download from their portal. "${pendingDelete.title}" cannot be recovered.`}
          confirmLabel="Delete resource"
          weight="irreversible"
          confirmPhrase={pendingDelete.title}
          pending={deleting}
          onConfirm={() => void confirmDeleteResource()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
