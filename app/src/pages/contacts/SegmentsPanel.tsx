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
import { EmptyState } from '../../components/EmptyState';
import { DEC_856 } from '../../../../src/decisions';
import { MAX_NAME_LENGTH } from '../../lib/text-caps';
import './contacts-panels.css';

// DEC-856 (wave 65 amendment): POST/PATCH /segments throws "Validation
// failed" with a fields map keyed `name` and/or `rules`
// (src/routes/api/contacts/segments.ts:104-193) -- read by shape, never
// collapsed to err.message. `name` routes to the save form's own control;
// `rules` has no editable control of its own (it is derived from the
// active directory filters), so it renders labelled beside the "Rules: ..."
// summary line instead. Any other key (none today) renders labelled
// "<key>: <message>" rather than being dropped.
void DEC_856;
const SEGMENT_FIELD_KEYS: readonly string[] = ['name', 'rules'];

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    setFieldErrors({});
    try {
      await apiPost('/segments', { name: name.trim(), rules });
      setName('');
      onChanged();
    } catch (err) {
      // DEC-856: a fields map is never collapsed to err.message -- `name`
      // routes to the save control, `rules` renders beside the rules
      // summary line, anything else renders labelled.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save segment');
      }
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

  const unownedFieldErrors = Object.entries(fieldErrors).filter(([key]) => !SEGMENT_FIELD_KEYS.includes(key));

  return (
    <div className="chq-contacts-segments">
      <h2 className="chq-section-label">Segments</h2>
      {error && <div className="chq-error">{error}</div>}

      <div className="chq-contacts-segments-save">
        <label className="chq-contacts-filter-rules-field">
          Save current filter as segment
          <input
            className={fieldErrors.name ? 'chq-input chq-field-invalid' : 'chq-input'}
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Segment name"
            aria-invalid={fieldErrors.name ? 'true' : undefined}
          />
        </label>
        {fieldErrors.name ? (
          <span role="alert" className="chq-field-error">
            {fieldErrors.name}
          </span>
        ) : null}
        <p className="chq-contacts-segments-rule">Rules: {describeRules(rules)}</p>
        {fieldErrors.rules ? (
          <span role="alert" className="chq-field-error">
            {fieldErrors.rules}
          </span>
        ) : null}
        {unownedFieldErrors.map(([key, message]) => (
          <span key={key} role="alert" className="chq-field-error">
            {`${key}: ${message}`}
          </span>
        ))}
        <div>
          <button type="button" className="chq-btn chq-btn-primary" disabled={busy || name.trim() === ''} onClick={save}>
            Save segment
          </button>
        </div>
      </div>

      {/* DEC-678: this panel's list carries no facet of its own to clear --
          it is the account's whole saved-segment set -- so a zero-row
          settle is always the 'fresh' voice, never 'filtered'. */}
      {segments.length === 0 ? (
        <EmptyState variant="fresh" what="No saved segments yet." action={null} />
      ) : (
        <ul className="chq-contacts-segment-list">
          {segments.map((seg) => (
            <li key={seg.id} className="chq-contacts-segment-row">
              <div className="chq-contacts-segment-row-main">
                <span className="chq-contacts-segment-name">{seg.name}</span>
                <span className="chq-contacts-segment-rule">{describeRules(seg.rules)}</span>
              </div>
              <button
                type="button"
                className="chq-btn chq-btn-secondary"
                disabled={busy}
                onClick={() => setPendingDelete(seg)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this segment"
          body={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete segment"
          pending={busy}
          onConfirm={() => remove(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
