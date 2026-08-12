// Views dropdown (DEC-031): left of the Submissions toolbar. Loads the
// event's saved views on mount, applies a view's filters/columns/sort on
// selection, offers 'Save current as view…' (name prompt -> POST) and a
// per-view delete.

import { useEffect, useState } from 'react';
import { apiDelete, apiList, apiPost, ApiError } from '../../lib/api';
import { serializeView, type SavedView, type SavedViewConfig } from './views';
import type { SubmissionsFilterState } from './types';

interface ViewsDropdownProps {
  eventId: string;
  filters: SubmissionsFilterState;
  visibleFieldIds: ReadonlySet<string>;
  onApply: (config: SavedViewConfig) => void;
}

export function ViewsDropdown({ eventId, filters, visibleFieldIds, onApply }: ViewsDropdownProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiList<SavedView>(`/events/${eventId}/views`)
      .then((res) => setViews(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load views'));
  }, [eventId]);

  async function saveCurrentAsView() {
    const name = window.prompt('Name this view:');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const config = serializeView(filters, visibleFieldIds);
      const created = await apiPost<SavedView>(`/events/${eventId}/views`, { name: trimmed, config });
      setViews((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof ApiError ? `Save view failed: ${err.message}` : 'Save view failed');
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
          <button type="button" className="chq-btn chq-btn-tertiary" disabled={saving} onClick={saveCurrentAsView}>
            Save current as view…
          </button>
        </div>
      </details>
    </div>
  );
}
