import { useState } from 'react';
import { apiDelete, apiPost, ApiError } from '../../lib/api';
import { buildSegmentRulesFromFilters, describeRules, type ActiveFilters } from './segments';
import type { Segment } from './types';

interface Props {
  segments: Segment[];
  activeFilters: ActiveFilters;
  onChanged: () => void;
}

export function SegmentsPanel({ segments, activeFilters, onChanged }: Props) {
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
