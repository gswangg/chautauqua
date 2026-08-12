import { useEffect, useState } from 'react';
import { apiDelete, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { COMPOSE_MERGE_FIELDS } from '../../lib/merge-fields';
import { DelayedLoading } from '../../components/DelayedLoading';
import type { EmailTemplate } from './types';

interface DraftTemplate {
  name: string;
  subject: string;
  bodyText: string;
}

const BLANK_DRAFT: DraftTemplate = { name: '', subject: '', bodyText: '' };

export function TemplatesTab({ eventId }: { eventId: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftTemplate>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);

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
  }

  function startEdit(t: EmailTemplate) {
    setEditingId(t.id);
    setDraft({ name: t.name, subject: t.subject, bodyText: t.bodyText });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (editingId === 'new') {
        await apiPost(`/events/${eventId}/templates`, draft);
      } else if (editingId) {
        await apiPatch(`/templates/${editingId}`, draft);
      }
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await apiDelete(`/templates/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete template');
    }
  }

  function insertChip(field: string) {
    setDraft((d) => ({ ...d, bodyText: `${d.bodyText}{${field}}` }));
  }

  return (
    <div className="chq-comms-templates-tab">
      {error && <div className="chq-error-banner">{error}</div>}
      {loading && <DelayedLoading label="Loading templates…" />}

      <div className="chq-toolbar">
        <button type="button" className="chq-btn chq-btn-primary" onClick={startNew}>
          New template
        </button>
      </div>

      <div className="chq-comms-templates">
        <section>
          <div className="chq-section-head">
            <span className="chq-section-label">Saved &middot; {templates.length}</span>
          </div>
          <table className="chq-table chq-comms-templates-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="chq-comms-template-name">{t.name}</div>
                  </td>
                  <td>
                    <div className="chq-comms-template-detail">{t.subject}</div>
                  </td>
                  <td>
                    <button type="button" className="chq-link-button" onClick={() => startEdit(t)}>
                      Edit
                    </button>{' '}
                    <button type="button" className="chq-link-button" onClick={() => remove(t.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {loaded && !loading && templates.length === 0 && (
                <tr>
                  <td colSpan={3}>No templates yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {editingId && (
          <section className="chq-comms-editor">
            <div className="chq-section-head">
              <span className="chq-section-label">{editingId === 'new' ? 'New template' : 'Edit template'}</span>
            </div>
            <label>
              <span className="chq-comms-editor-label">Subject</span>
              <input
                className="chq-input"
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              />
            </label>
            <label>
              <span className="chq-comms-editor-label">Name</span>
              <input className="chq-input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </label>
            <label>
              <span className="chq-comms-editor-label">Body</span>
              <textarea
                className="chq-textarea"
                rows={8}
                value={draft.bodyText}
                onChange={(e) => setDraft((d) => ({ ...d, bodyText: e.target.value }))}
              />
            </label>

            <div className="chq-comms-merge-chips">
              {COMPOSE_MERGE_FIELDS.map((field) => (
                <button key={field} type="button" className="chq-pill" onClick={() => insertChip(field)}>
                  {`{${field}}`}
                </button>
              ))}
            </div>

            <div className="chq-comms-editor-actions">
              <button type="button" className="chq-btn chq-btn-primary" disabled={saving} onClick={save}>
                Save
              </button>
              <button type="button" className="chq-btn chq-btn-secondary" disabled={saving} onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
