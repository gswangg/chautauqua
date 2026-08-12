// Saved views as a VISIBLE tab row (DEC-648), replacing the disclosure
// ViewsDropdown used to hide behind. Mock: docs/design/Chautauqua
// Submissions.dc.html:66-72 -- a `VIEW` caption, then built-in presets, then
// the event's own saved views, then a trailing `Save current as view`
// action. The active tab is DERIVED from the live filter/column state via
// activeViewKey, never from which tab was last clicked.

import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { apiDelete, apiList, apiPost, ApiError } from '../../lib/api';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { serializeView, type SavedView, type SavedViewConfig } from './views';
import { STATUS_LABELS, type SubmissionsFilterState } from './types';

export interface BuiltInView {
  key: string;
  name: string;
  config: SavedViewConfig;
}

/** The mock's three built-in presets, in display order. Each is a full
 * SavedViewConfig so activeViewKey can compare it against the live state the
 * same way it compares a server-saved view -- one comparison rule for both
 * kinds of tab. */
export function builtInViews(): BuiltInView[] {
  return [
    {
      key: 'builtin-needs-triage',
      name: 'Needs triage',
      config: { q: '', status: ['pending'], trackId: null, sort: 'newest', columns: [] },
    },
    {
      key: 'builtin-all',
      name: 'All submissions',
      config: { q: '', status: [], trackId: null, sort: 'newest', columns: [] },
    },
    {
      key: 'builtin-accept-queue',
      name: 'Accept queue',
      config: { q: '', status: ['accept_queue'], trackId: null, sort: 'newest', columns: [] },
    },
  ];
}

function normalize(config: SavedViewConfig): string {
  return JSON.stringify({
    q: config.q.trim(),
    status: [...config.status].sort(),
    trackId: config.trackId ?? null,
    sort: config.sort,
    columns: [...config.columns].sort(),
  });
}

function configsEqual(a: SavedViewConfig, b: SavedViewConfig): boolean {
  return normalize(a) === normalize(b);
}

/** DEC-648: derives which tab (if any) matches the live filter + column
 * state, by comparing serializeView(filters, visibleFieldIds) against each
 * built-in's config, then each saved view's config. Returns the built-in's
 * `key` or the saved view's `id`, or null if nothing matches -- never click
 * state. */
export function activeViewKey(
  filters: SubmissionsFilterState,
  visibleFieldIds: ReadonlySet<string>,
  savedViews: readonly SavedView[],
): string | null {
  const current = serializeView(filters, visibleFieldIds);
  for (const view of builtInViews()) {
    if (configsEqual(current, view.config)) return view.key;
  }
  for (const view of savedViews) {
    if (configsEqual(current, view.config)) return view.id;
  }
  return null;
}

function summarizeFilters(filters: SubmissionsFilterState): string {
  const parts: string[] = [];
  if (filters.q.trim().length > 0) parts.push(`search “${filters.q.trim()}”`);
  if (filters.status.length > 0) {
    parts.push(`status ${filters.status.map((s) => STATUS_LABELS[s]).join(', ')}`);
  }
  if (filters.trackId) parts.push('a track filter');
  if (parts.length === 0) return 'Saves the current view with no filters applied.';
  return `Saves the current view: ${parts.join(' · ')}.`;
}

interface SaveViewDialogProps {
  filters: SubmissionsFilterState;
  pending: boolean;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}

// DEC-651: the ONE dialog header contract -- .chq-modal-title, a Close
// control, and a placeholder on the free-text input -- plus DEC-648's
// primary-first action order. saved_view has no owner column (event-scoped
// only), so sharing is a static caption, not a toggle the server can't
// persist.
function SaveViewDialog({ filters, pending, onCancel, onSave }: SaveViewDialogProps) {
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
    <div className="chq-scrim" role="dialog" aria-modal="true" aria-label="Save this view" onClick={handleScrimClick}>
      <form className="chq-modal" onSubmit={submit}>
        <div className="chq-submissions-viewtabs-dialog-head">
          <h2 className="chq-modal-title">Save this view</h2>
          <button type="button" className="chq-modal-close" onClick={onCancel} disabled={pending} aria-label="Close">
            &times;
          </button>
        </div>
        <p className="chq-modal-sub">{summarizeFilters(filters)}</p>
        {error && <div className="chq-error">{error}</div>}
        <label className="chq-submissions-modal-field">
          <span className="chq-submissions-modal-label">Name</span>
          <input
            className="chq-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="AI track, unread"
            autoFocus
            disabled={pending}
          />
        </label>
        <p className="chq-modal-sub">Shared with every organiser on this event.</p>
        <div className="chq-modal-actions">
          <button type="submit" className="chq-btn chq-btn-primary" disabled={pending}>
            Save the view
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

interface ViewTabsProps {
  eventId: string;
  filters: SubmissionsFilterState;
  visibleFieldIds: ReadonlySet<string>;
  onApply: (config: SavedViewConfig) => void;
}

export function ViewTabs({ eventId, filters, visibleFieldIds, onApply }: ViewTabsProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    apiList<SavedView>(`/events/${eventId}/views`)
      .then((res) => setViews(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load views'));
  }, [eventId]);

  const active = activeViewKey(filters, visibleFieldIds, views);

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
    <div className="chq-submissions-viewtabs" role="group" aria-label="Saved views">
      {error && <div className="chq-error">{error}</div>}
      <span className="chq-submissions-viewtabs-label">View</span>
      {builtInViews().map((view) => (
        <button
          key={view.key}
          type="button"
          className={active === view.key ? 'chq-viewtab is-active' : 'chq-viewtab'}
          aria-current={active === view.key ? 'true' : undefined}
          onClick={() => onApply(view.config)}
        >
          {view.name}
        </button>
      ))}
      {views.map((view) => (
        <span key={view.id} className="chq-submissions-viewtabs-item">
          <button
            type="button"
            className={active === view.id ? 'chq-viewtab is-active' : 'chq-viewtab'}
            aria-current={active === view.id ? 'true' : undefined}
            onClick={() => onApply(view.config)}
          >
            {view.name}
          </button>
          <button
            type="button"
            className="chq-submissions-viewtabs-delete"
            aria-label={`Delete ${view.name}`}
            onClick={() => deleteView(view.id)}
          >
            &times;
          </button>
        </span>
      ))}
      <button
        type="button"
        className="chq-viewtab chq-submissions-viewtabs-save"
        disabled={saving}
        onClick={() => setShowSaveDialog(true)}
      >
        Save current as view
      </button>

      {showSaveDialog && (
        <SaveViewDialog
          filters={filters}
          pending={saving}
          onCancel={() => setShowSaveDialog(false)}
          onSave={saveCurrentAsView}
        />
      )}
    </div>
  );
}
