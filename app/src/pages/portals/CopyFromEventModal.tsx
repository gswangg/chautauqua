// Portals overview · Copy from another event: another event's portals (with
// the library items they use) and/or its sponsor tiers, copied into this
// one. Names that already exist here are skipped, never overwritten, and
// the result says so. Nobody is emailed by a copy.
import { useState } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { EmptyState } from '../../components/EmptyState';
import { FormRow, ModalFrame } from '../../components/ModalFrame';
import { apiPost, ApiError } from '../../lib/api';
import { useCachedGet } from '../../lib/useCachedRead';
import { countOf } from '../../lib/plural';
import type { CopyResult, CopySource } from './types';

interface CopyFromEventModalProps {
  eventId: string;
  onClose: () => void;
}

function resultLine(result: CopyResult): string {
  const parts: string[] = [];
  if (result.portals > 0) parts.push(countOf(result.portals, 'portal'));
  if (result.tiers > 0) parts.push(countOf(result.tiers, 'sponsor tier'));
  if (result.tasks > 0) parts.push(countOf(result.tasks, 'library item'));
  return parts.length > 0 ? `Copied ${parts.join(', ')}.` : 'Nothing new was copied.';
}

export function CopyFromEventModal({ eventId, onClose }: CopyFromEventModalProps) {
  const { data, loading, error } = useCachedGet<{ events: CopySource[] }>(`/events/${eventId}/portals/copy-sources`, 'The other events could not be loaded.');
  const [sourceId, setSourceId] = useState('');
  const [portals, setPortals] = useState(true);
  const [tiers, setTiers] = useState(true);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [result, setResult] = useState<CopyResult | null>(null);

  const events = data?.events ?? [];
  const source = events.find((e) => e.id === sourceId) ?? null;

  async function copy() {
    if (!source) return;
    setCopying(true);
    setCopyError(null);
    try {
      setResult(await apiPost<CopyResult>(`/events/${eventId}/portals/copy`, { sourceEventId: source.id, portals, tiers }));
    } catch (err) {
      setCopyError(err instanceof ApiError ? err.message : 'Nothing could be copied.');
    } finally {
      setCopying(false);
    }
  }

  if (result) {
    return (
      <ModalFrame
        title="Copied"
        subtitle={source ? `From ${source.name}` : undefined}
        onClose={onClose}
        modalClassName="chq-portal-modal"
        actions={
          <button type="button" className="chq-btn chq-btn-primary" onClick={onClose}>
            Done
          </button>
        }
      >
        <p className="chq-portal-modal-note">{resultLine(result)}</p>
        {result.skipped.length > 0 ? (
          <section className="chq-portal-preview-section" aria-label="Skipped">
            <div className="chq-section-head">
              <span className="chq-section-label">Skipped · {result.skipped.length}</span>
            </div>
            <ul className="chq-portal-preview-lines">
              {result.skipped.map((line) => (
                <li key={line} className="chq-portal-preview-line">
                  <span className="chq-portal-preview-title">{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="chq-portal-modal-note">Fixed deadlines were left off copied items, since they belong to the other event’s calendar. Nobody was emailed.</p>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame
      title="Copy from another event"
      subtitle="Portals and sponsor tiers; names already here are skipped"
      onClose={onClose}
      closeDisabled={copying}
      modalClassName="chq-portal-modal"
      actions={
        events.length > 0 ? (
          <>
            <button
              type="button"
              className={copying ? 'chq-btn chq-btn-primary chq-btn-pending' : 'chq-btn chq-btn-primary'}
              disabled={!source || (!portals && !tiers) || copying}
              onClick={() => void copy()}
            >
              {copying ? 'Copying…' : 'Copy'}
            </button>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose} disabled={copying}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      {loading && !data ? <DelayedLoading label="Loading your other events…" /> : null}
      {error ? (
        <p className="chq-error" role="alert">
          {error}
        </p>
      ) : null}
      {data && events.length === 0 ? (
        <EmptyState variant="fresh" what="No other events to copy from." reason="Portals and tiers can be copied once your organisation has another event." />
      ) : null}
      {events.length > 0 ? (
        <>
          <FormRow label="Event" htmlFor="copy-source">
            <select id="copy-source" className="chq-select" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Choose an event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {countOf(e.portals, 'portal')}, {countOf(e.tiers, 'tier')}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Copy" help="Library items the portals use come along. Rules that name a tier or track are matched to this event’s by name.">
            <div className="chq-portal-checks">
              <label className="chq-checkbox-label">
                <input type="checkbox" className="chq-check" checked={portals} onChange={(e) => setPortals(e.target.checked)} disabled={copying} />
                Portals{source ? ` · ${source.portals}` : ''}
              </label>
              <label className="chq-checkbox-label">
                <input type="checkbox" className="chq-check" checked={tiers} onChange={(e) => setTiers(e.target.checked)} disabled={copying} />
                Sponsor tiers{source ? ` · ${source.tiers}` : ''}
              </label>
            </div>
          </FormRow>
          {!portals && !tiers ? <p className="chq-portal-modal-note">Choose portals, tiers, or both.</p> : null}
        </>
      ) : null}
      {copyError ? (
        <p className="chq-error" role="alert">
          {copyError}
        </p>
      ) : null}
    </ModalFrame>
  );
}
