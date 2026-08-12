// Views dropdown (DEC-031): left of the Submissions toolbar. Loads the
// event's saved views on mount, applies a view's filters/columns/sort on
// selection, offers 'Save current as view…' (the ONE dialog contract: scrim
// + role="dialog" aria-modal + useEscapeKey, same as NewSubmissionModal /
// EventSwitcher -> POST) and a per-view delete.

import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { apiDelete, apiList, apiPost, ApiError } from '../../lib/api';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { serializeView, type SavedView, type SavedViewConfig } from './views';
import type { SubmissionsFilterState } from './types';

interface ViewsDropdownProps {
  eventId: string;
  filters: SubmissionsFilterState;
  visibleFieldIds: ReadonlySet<string>;
  onApply: (config: SavedViewConfig) => void;
}

interface SaveViewDialogProps {
  pending: boolean;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}

function SaveViewDialog({ pending, onCancel, onSave }: SaveViewDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(!pending, onCancel);

  function handleScrimClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !pending) onCancel();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError(null);
    try {
      await onSave(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save view');
    }
  }

  return (
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Name this view" onClick={handleScrimClick}>
      <form className="chq-modal" onSubmit={submit}>
        <h2>Name this view</h2>
        {error && <div className="chq-error">{error}</div>}
        <label className="chq-submissions-modal-field">
          <span className="chq-submissions-modal-label">Name</span>
          <input
            className="chq-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={pending}
          />
        </label>
        <div className="chq-modal-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={pending}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export function ViewsDropdown({ eventId, filters, visibleFieldIds, onApply }: ViewsDropdownProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    apiList<SavedView>(`/events/${eventId}/views`)
      .then((res) => setViews(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load views'));
  }, [eventId]);

  async function saveCurrentAsView(name: string) {
    setSaving(true);
    setError(null);
    try {
      const config = serializeView(filters, visibleFieldIds);
      const created = await apiPost<SavedView>(`/events/${eventId}/views`, { name, config });
      setViews((prev) => [...prev, created]);
      setShowSaveDialog(false);
    } catch (err) {
      setError(err instanceof ApiError ? `Save view failed: ${err.message}` : 'Save view failed');
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function deleteView(id: string) {
    setError(null);
    const previous = views;
    setViews((prev) => prev.filter((v) => v.id !== id));
    try {
      await apiDelete(`/views/${id}`);
    } catch (err) {
      setViews(previous);
      setError(err instanceof ApiError ? `Delete view failed: ${err.message}` : 'Delete view failed');
    }
  }

  return (
    <div className="chq-submissions-views">
      {error && <div className="chq-error">{error}</div>}
      <details>
        <summary>Views{views.length > 0 ? ` (${views.length})` : ''}</summary>
        <div className="chq-submissions-views-panel">
          <ul className="chq-submissions-views-list">
            {views.length === 0 && <li className="chq-submissions-views-empty">No saved views yet.</li>}
            {views.map((view) => (
              <li key={view.id} className="chq-submissions-views-item">
                <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => onApply(view.config)}>
                  {view.name}
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  aria-label={`Delete ${view.name}`}
                  onClick={() => deleteView(view.id)}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="chq-btn chq-btn-tertiary"
            disabled={saving}
            onClick={() => setShowSaveDialog(true)}
          >
            Save current as view…
          </button>
        </div>
      </details>
      {showSaveDialog && (
        <SaveViewDialog pending={saving} onCancel={() => setShowSaveDialog(false)} onSave={saveCurrentAsView} />
      )}
    </div>
  );
}
