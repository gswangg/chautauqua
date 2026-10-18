// Speakers · Not in any portal (Portals frame, flow 1: /speakers?portal=none).
// Every participation no portal's rule matches, with the reason, so an
// organizer can see who would otherwise get no portal at all. Opened from
// the coverage count in Settings · Portals or the portal filter on the
// Speakers grid; rows leave as soon as a rule or status change puts them in
// a portal (the list is computed on read).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { useCachedGet } from '../../lib/useCachedRead';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import type { UnmatchedRow } from '../portals/types';
import { PortalFilterSelect } from './PortalFilterSelect';
import './not-in-portal.css';

export function NotInPortalView({ onShowAll, onAddSpeaker }: { onShowAll: () => void; onAddSpeaker: () => void }) {
  const { eventId, error: eventError } = useCurrentEvent();
  const unmatchedPath = useMemo(() => (eventId ? `/events/${eventId}/portals/unmatched` : null), [eventId]);
  const read = useCachedGet<{ rows: UnmatchedRow[]; total: number }>(unmatchedPath, 'Failed to load the participations no portal covers');
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const all = read.data?.rows ?? [];
    const needle = q.trim().toLowerCase();
    if (needle === '') return all;
    return all.filter((r) => r.name.toLowerCase().includes(needle) || r.participation.toLowerCase().includes(needle));
  }, [read.data, q]);
  const total = read.data?.total ?? 0;

  return (
    <div className="chq-page chq-speakers-page chq-measure-table">
      <div className="chq-speakers-head">
        <div className="chq-speakers-head-titles">
          <h1 className="chq-page-title">Speakers</h1>
          {read.data ? <span className="chq-not-in-portal-count">{`${total} not in any portal`}</span> : null}
        </div>
        <div className="chq-speakers-head-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onAddSpeaker}>
            Add speaker
          </button>
        </div>
      </div>

      <div className="chq-not-in-portal-toolbar">
        <div className="chq-speakers-filters">
          <input
            type="text"
            className="chq-input chq-speakers-filters-search"
            aria-label="Search people"
            placeholder="Search person or session…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <PortalFilterSelect value="none" onChange={(v) => (v === 'any' ? onShowAll() : undefined)} />
        </div>
      </div>

      {eventError || read.error ? <p className="chq-error" role="alert">{eventError ?? read.error}</p> : null}
      {read.loading && !read.data ? <PageSkeleton variant="table" label="Loading participations…" /> : null}

      {read.data && total === 0 ? (
        <EmptyState
          variant="fresh"
          what="Every participation is in a portal"
          reason="When a session is accepted or a sponsor joins and no portal's rule matches them, they show up here."
          secondary={{ label: 'Open Settings · Portals', to: '/settings/portals' }}
        />
      ) : null}
      {read.data && total > 0 && rows.length === 0 ? (
        <EmptyState
          variant="filtered"
          what={`No one matches "${q.trim()}"`}
          escape={{ label: 'Clear the search', onClick: () => setQ('') }}
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="chq-not-in-portal" role="table" aria-label="Participations not in any portal">
          <div className="chq-not-in-portal-head" role="row">
            <span role="columnheader">Person</span>
            <span role="columnheader">Participation</span>
            <span role="columnheader">Why</span>
            <span role="columnheader" className="chq-not-in-portal-action-head">
              Record
            </span>
          </div>
          {rows.map((r) => (
            <div key={r.key} className="chq-not-in-portal-row" role="row">
              <span role="cell" className="chq-not-in-portal-name">
                {r.name}
              </span>
              <span role="cell" className="chq-not-in-portal-participation">
                {r.participation}
              </span>
              <span role="cell" className="chq-not-in-portal-why">
                {r.reason}
              </span>
              <span role="cell" className="chq-not-in-portal-action">
                <Link className="chq-not-in-portal-record-link" to={`/contacts/${r.contactId}`}>
                  Open record
                </Link>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
