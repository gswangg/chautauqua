// Resources panel (w4-h, DEC-032; file kind w6-d/DEC-047): wiki page
// list/create/edit/delete with textarea content, plus an "Upload file
// resource" form (multipart -> kind='file', served to organizers via
// GET /files/:fileId).
import { useEffect, useState } from 'react';
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

export function ResourcesPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [newResource, setNewResource] = useState<ResourceForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<ResourceFormErrors>({});
  const [editing, setEditing] = useState<Record<string, ResourceForm>>({});
  const [fileTitle, setFileTitle] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);

  function reload(id: string) {
    apiList<Resource>(`/events/${id}/resources`)
      .then((res) => setResources(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load resources'));
  }

  useEffect(() => {
    if (!eventId) return;
    reload(eventId);
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
      setEditing((prev) => {
        const next = { ...prev };
        delete next[resource.id];
        return next;
      });
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
    <section className="chq-settings-panel" aria-label="Resources">
      <h2>Resources</h2>
      {eventLoading ? <p>Loading…</p> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}

      <ul>
        {resources.map((resource) => {
          const editForm = editing[resource.id];
          return (
            <li key={resource.id}>
              <span data-testid="resource-kind-badge">{resource.kind === 'file' ? 'File' : 'Wiki'}</span>
              {editForm && resource.kind === 'wiki' ? (
                <div>
                  <input
                    value={editForm.title}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [resource.id]: { ...editForm, title: e.target.value } }))
                    }
                  />
                  <textarea
                    value={editForm.content}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [resource.id]: { ...editForm, content: e.target.value } }))
                    }
                  />
                  <button type="button" onClick={() => void saveEdit(resource)}>
                    Save
                  </button>
                </div>
              ) : (
                <div>
                  <strong>{resource.title}</strong>
                  {resource.kind === 'file' && resource.fileId ? (
                    <p>
                      <a href={`/files/${resource.fileId}`}>Download</a>
                    </p>
                  ) : (
                    <p>{resource.content}</p>
                  )}
                  {resource.kind === 'wiki' ? (
                    <button type="button" onClick={() => startEdit(resource)}>
                      Edit
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void deleteResource(resource)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h3>Add a wiki page</h3>
      <div>
        <input
          placeholder="Title"
          value={newResource.title}
          onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
        />
        {fieldErrors.title ? <span role="alert">{fieldErrors.title}</span> : null}
        <textarea
          placeholder="Content"
          value={newResource.content}
          onChange={(e) => setNewResource({ ...newResource, content: e.target.value })}
        />
        {fieldErrors.content ? <span role="alert">{fieldErrors.content}</span> : null}
        <button type="button" onClick={() => void addResource()}>
          Add resource
        </button>
      </div>

      <h3>Upload file resource</h3>
      <div>
        <input
          placeholder="Title"
          value={fileTitle}
          onChange={(e) => setFileTitle(e.target.value)}
        />
        <input
          type="file"
          onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)}
        />
        {fileError ? <span role="alert">{fileError}</span> : null}
        <button type="button" onClick={() => void uploadFileResource()}>
          Upload file resource
        </button>
      </div>
    </section>
  );
}
