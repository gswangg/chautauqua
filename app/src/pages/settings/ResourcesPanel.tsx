// Resources (w4-h, DEC-047; folded into Speaker portal's read view w3-c,
// DEC-747): wiki page list/create/edit/delete plus file-resource upload.
// Rendered as a fragment (no own <section>/h2) inside PortalSettingsPanel's
// Resources row -- 'Add a resource' toggles both add-forms; a wiki row's
// 'Replace' opens its inline edit form. A file row has no replace control:
// there is no server endpoint that replaces a file's bytes, and DEC-733
// says omit a control the store can't carry rather than render it
// disabled. A wiki resource's read row names the page and its SIZE (word
// count), never its raw markdown body (DEC-747).
import { useEffect, useState } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiDelete, apiList, apiPatch, apiPost, apiUpload, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { validateResourceForm, type ResourceForm, type ResourceFormErrors } from './formState';

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
  const count = wordCount(resource.content);
  return `${count} word${count === 1 ? '' : 's'}`;
}

export function ResourcesPanel() {
  const { eventId } = useCurrentEvent();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [newResource, setNewResource] = useState<ResourceForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<ResourceFormErrors>({});
  const [editing, setEditing] = useState<Record<string, ResourceForm>>({});
  const [fileTitle, setFileTitle] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);

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

  async function addResource() {
    if (!eventId) return;
    const errors = validateResourceForm(newResource);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await apiPost(`/events/${eventId}/resources`, {
        title: newResource.title,
        content: newResource.content,
      });
      setNewResource(EMPTY_FORM);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add resource');
    }
  }

  async function uploadFileResource() {
    if (!eventId) return;
    if (fileTitle.trim().length === 0) {
      setFileError('Title is required');
      return;
    }
    if (!fileToUpload) {
      setFileError('File is required');
      return;
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
    } catch (err) {
      setFileError(err instanceof ApiError ? err.message : 'Failed to upload resource');
    }
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
    const errors = validateResourceForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    try {
      await apiPatch(`/resources/${resource.id}`, { title: form.title, content: form.content });
      cancelEdit(resource);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save resource');
    }
  }

  async function deleteResource(resource: Resource) {
    if (!eventId) return;
    try {
      await apiDelete(`/resources/${resource.id}`);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete resource');
    }
  }

  return (
    <div className="chq-settings-portal-resources-block">
      {loading ? <DelayedLoading /> : null}
      {error ? <p role="alert">{error}</p> : null}

      <ul className="chq-settings-portal-resource-list">
        {resources.map((resource) => {
          const editForm = editing[resource.id];
          return (
            <li key={resource.id} className="chq-settings-portal-resource-row">
              {editForm && resource.kind === 'wiki' ? (
                <div className="chq-settings-portal-resource-edit">
                  <input
                    className="chq-input"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [resource.id]: { ...editForm, title: e.target.value } }))
                    }
                  />
                  <textarea
                    className="chq-textarea"
                    value={editForm.content}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [resource.id]: { ...editForm, content: e.target.value } }))
                    }
                  />
                  {fieldErrors.title ? <span role="alert">{fieldErrors.title}</span> : null}
                  {fieldErrors.content ? <span role="alert">{fieldErrors.content}</span> : null}
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
                  ) : null}
                  <button type="button" className="chq-link-button" onClick={() => void deleteResource(resource)}>
                    Delete
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="chq-settings-portal-resource-add">
          <h3>Add a wiki page</h3>
          <input
            className="chq-input"
            placeholder="Title"
            value={newResource.title}
            onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
          />
          {fieldErrors.title ? <span role="alert">{fieldErrors.title}</span> : null}
          <textarea
            className="chq-textarea"
            placeholder="Content"
            value={newResource.content}
            onChange={(e) => setNewResource({ ...newResource, content: e.target.value })}
          />
          {fieldErrors.content ? <span role="alert">{fieldErrors.content}</span> : null}
          <button type="button" className="chq-btn chq-btn-primary" onClick={() => void addResource()}>
            Add wiki page
          </button>

          <h3>Upload a file</h3>
          <input
            className="chq-input"
            placeholder="Title"
            value={fileTitle}
            onChange={(e) => setFileTitle(e.target.value)}
          />
          <input className="chq-file" type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)} />
          {fileError ? <span role="alert">{fileError}</span> : null}
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void uploadFileResource()}>
            Upload file
          </button>

          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setAdding(false)}>
            Done
          </button>
        </div>
      ) : (
        <button type="button" className="chq-settings-portal-add-resource" onClick={() => setAdding(true)}>
          Add a resource
        </button>
      )}
    </div>
  );
}
