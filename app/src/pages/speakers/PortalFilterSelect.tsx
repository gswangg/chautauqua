// The Speakers toolbar's portal filter (Portals frame, flow 1): "Any portal"
// is the whole onboarding grid, "Not in any portal" the list of
// participations no portal covers (/speakers?portal=none), and each portal
// is that portal's view of the grid (/speakers?portal=<id>, multi-portal
// decision 73): its people as rows, its task items as columns.
import { useMemo } from 'react';
import { useCachedGet } from '../../lib/useCachedRead';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import type { PortalOverview } from '../portals/types';

// 'any', 'none', or a portal id
export type PortalFilterValue = string;

export function PortalFilterSelect({ value, onChange }: { value: PortalFilterValue; onChange: (v: PortalFilterValue) => void }) {
  const { eventId } = useCurrentEvent();
  const path = useMemo(() => (eventId ? `/events/${eventId}/portals` : null), [eventId]);
  const overview = useCachedGet<PortalOverview>(path, 'Failed to load portals');
  const portals = overview.data?.portals ?? [];
  // a portal id from the URL before the list arrives still selects itself
  const pending = value !== 'any' && value !== 'none' && !portals.some((p) => p.id === value);
  return (
    <select className="chq-select" aria-label="Filter by portal" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="any">Any portal</option>
      {portals.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      {pending ? <option value={value}>This portal</option> : null}
      <option value="none">Not in any portal</option>
    </select>
  );
}
