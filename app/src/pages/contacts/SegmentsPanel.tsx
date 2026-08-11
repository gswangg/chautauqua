import { useState } from 'react';
import { apiDelete, apiPost, ApiError } from '../../lib/api';
import { buildSegmentRulesFromFilters, describeRules, type ActiveFilters } from './segments';
import type { Segment } from './types';

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
    }
  }

  return (
    <div className="chq-segments-panel">
      <h2>Segments</h2>
      {error && <div className="chq-error-banner">{error}</div>}

      <div className="chq-save-segment">
        <label>
          Save current filter as segment
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name" />
        </label>
        <p>Rules: {describeRules(rules)}</p>
        <button type="button" disabled={busy || name.trim() === ''} onClick={save}>
          Save segment
        </button>
      </div>

      <ul className="chq-segment-list">
        {segments.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong> — {describeRules(s.rules)}
            <button type="button" disabled={busy} onClick={() => remove(s.id)}>
              Delete
            </button>
          </li>
        ))}
        {segments.length === 0 && <li>No saved segments yet.</li>}
      </ul>
    </div>
  );
}
