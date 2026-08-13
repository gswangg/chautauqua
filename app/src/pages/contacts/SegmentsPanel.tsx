// Saved segments (CRM-02, DEC-149). Behaviour frozen (DEC-366): SegmentRule
// shape and the persisted rules are untouched — this only restyles the
// panel. DEC-377: the mock's per-segment count has no backing field on
// GET /segments (src/routes/api/contacts.ts serializeSegment returns
// {id, name, rules} only), so that caption is dropped rather than invented.
import { useState } from 'react';
import { apiDelete, apiPost, ApiError } from '../../lib/api';
import { buildSegmentRulesFromFilters, describeRules, type ActiveFilters } from './segments';
import type { Segment } from './types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import './contacts-panels.css';

interface Props {
  segments: Segment[];
  activeFilters: ActiveFilters;
  // The segment id currently applied as the directory's filter, if any
  // (P3 fix, DEC-239/w1-c): deleting this segment must clear it BEFORE the
  // delete-triggered reload, or the list refetches with a now-nonexistent
  // segmentId and 500s ("Internal server error" flash).
  activeSegmentId: string;
  onChanged: () => void;
  onDeletedActiveSegment: () => void;
}

export function SegmentsPanel({ segments, activeFilters, activeSegmentId, onChanged, onDeletedActiveSegment }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Delete is destructive and irreversible, so it goes through the shared
  // ConfirmDialog contract (DEC-631) naming the view being removed, rather
  // than deleting on click.
  const [pendingDelete, setPendingDelete] = useState<Segment | null>(null);

  const rules = buildSegmentRulesFromFilters(activeFilters);

  async function save() {
    if (name.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/segments', { name: name.trim(), rules });
      setName('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save segment');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/segments/${id}`);
      // Clear the applied-segment filter state first (if this was it) so
      // the directory's refetch never asks the server for a deleted
      // segmentId — then reload the segment list itself.
      if (id === activeSegmentId) onDeletedActiveSegment();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete segment');
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  }

  return (
    <div className="chq-contacts-segments">
      <h2 className="chq-section-label">Segments</h2>
      {error && <div className="chq-error">{error}</div>}

      <div className="chq-contacts-segments-save">
        <label className="chq-contacts-filter-rules-field">
          Save current filter as segment
          <input
            className="chq-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Segment name"
          />
        </label>
        <p className="chq-contacts-segments-rule">Rules: {describeRules(rules)}</p>
        <div>
          <button type="button" className="chq-btn chq-btn-primary" disabled={busy || name.trim() === ''} onClick={save}>
            Save segment
          </button>
        </div>
      </div>

      <ul className="chq-contacts-segment-list">
        {segments.map((s) => (
          <li key={s.id} className="chq-contacts-segment-row">
            <div className="chq-contacts-segment-row-main">
              <span className="chq-contacts-segment-name">{s.name}</span>
              <span className="chq-contacts-segment-rule">{describeRules(s.rules)}</span>
            </div>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={busy}
              onClick={() => setPendingDelete(s)}
            >
              Delete
            </button>
          </li>
        ))}
        {segments.length === 0 && <li className="chq-empty">No saved segments yet.</li>}
      </ul>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this segment"
          body={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          pending={busy}
          onConfirm={() => remove(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
