// Saved views as a VISIBLE tab row (DEC-648), replacing the disclosure
// ViewsDropdown used to hide behind. Mock: docs/design/Chautauqua
// Submissions.dc.html:66-72 -- a `VIEW` caption, then built-in presets, then
// the event's own saved views, then a trailing `Save current as view`
// action. The active tab is DERIVED from the live filter/column state via
// activeViewKey, never from which tab was last clicked.

import { useEffect, useState, type FormEvent } from 'react';
import { apiDelete, apiList, apiPost, ApiError } from '../../lib/api';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { sortLabel } from './FilterBar';
import { serializeView, type SavedView, type SavedViewConfig } from './views';
import { STATUS_LABELS, type SubmissionsFilterState, type Track } from './types';

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

/** DEC-750: the save-view subtitle names the ACTUAL current filter/sort
 * state (e.g. "Pending · AI Engineering · newest first") rather than a
 * generic "Saves the current view" sentence -- status first, then a search
 * term, then the track name (if filtered), then the sort order (always
 * present), joined with " · ". */
export function summarizeFilters(filters: SubmissionsFilterState, tracks: readonly Track[]): string {
  const parts: string[] = [];
  if (filters.status.length > 0) {
    parts.push(filters.status.map((s) => STATUS_LABELS[s]).join(', '));
  }
  if (filters.q.trim().length > 0) parts.push(`search “${filters.q.trim()}”`);
  if (filters.trackId) {
    const track = tracks.find((t) => t.id === filters.trackId);
    parts.push(track ? track.name : 'a track filter');
  }
  parts.push(sortLabel(filters.sort).toLowerCase());
  return parts.join(' · ');
}

interface SaveViewDialogProps {
  filters: SubmissionsFilterState;
  tracks: readonly Track[];
  pending: boolean;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}

// DEC-651/DEC-750: ModalFrame like every other dialog, primary bottom-left
// (modal-frame.css). saved_view has no owner column (event-scoped only), so
// sharing is a static caption, not a checkbox toggle the store can't persist.
function SaveViewDialog({ filters, tracks, pending, onCancel, onSave }: SaveViewDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    <ModalFrame
      as="form"
      onSubmit={submit}
      title="Save this view"
      subtitle={summarizeFilters(filters, tracks)}
      onClose={onCancel}
      closeDisabled={pending}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={pending}>
            Save the view
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </>
      }
    >
      {error && <div className="chq-error">{error}</div>}
      <FormRow label="Name it" htmlFor="save-view-name">
        <input
          id="save-view-name"
          className="chq-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="AI track, unread"
          autoFocus
          disabled={pending}
        />
      </FormRow>
      <p className="chq-submissions-modal-sub">Everyone organising this event sees it.</p>
    </ModalFrame>
  );
}

interface ViewTabsProps {
  eventId: string;
  filters: SubmissionsFilterState;
  visibleFieldIds: ReadonlySet<string>;
  tracks: readonly Track[];
  onApply: (config: SavedViewConfig) => void;
}

export function ViewTabs({ eventId, filters, visibleFieldIds, tracks, onApply }: ViewTabsProps) {
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
          className={active === view.key ? 'chq-submissions-viewtab is-active' : 'chq-submissions-viewtab'}
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
            className={active === view.id ? 'chq-submissions-viewtab is-active' : 'chq-submissions-viewtab'}
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
        className="chq-submissions-viewtab chq-submissions-viewtabs-save"
        disabled={saving}
        onClick={() => setShowSaveDialog(true)}
      >
        Save current as view
      </button>

      {showSaveDialog && (
        <SaveViewDialog
          filters={filters}
          tracks={tracks}
          pending={saving}
          onCancel={() => setShowSaveDialog(false)}
          onSave={saveCurrentAsView}
        />
      )}
    </div>
  );
}
