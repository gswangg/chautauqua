// Resources panel (w4-h, DEC-032): wiki page list/create/edit/delete with
// textarea content. Creation via this API is kind='wiki' only — file-kind
// resources need w3-f's upload plumbing (later wave), per the task's
// server-side note and DEC-029's portal render contract.
import { useEffect, useState } from 'react';
import { apiDelete, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { validateResourceForm, type ResourceForm, type ResourceFormErrors } from './formState';

interface Resource {
  id: string;
  kind: string;
  title: string;
  content: string | null;
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
              {editForm ? (
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
                  <p>{resource.content}</p>
                  <button type="button" onClick={() => startEdit(resource)}>
                    Edit
                  </button>
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
    </section>
  );
}
