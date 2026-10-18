import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCachedGet } from '../lib/useCachedRead';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { countOf } from '../lib/plural';
import type { SponsorshipsOverview } from './portals/types';
import { OnboardingGrid } from './speakers/OnboardingGrid';
import { NotInPortalView } from './speakers/NotInPortalView';
import { RosterPanel, type RosterPanelMode } from './speakers/RosterPanel';
import './speakers/speakers.css';

export function SpeakersPage() {
  // Bumping this key forces OnboardingGrid to remount and re-fetch, which is
  // this page's existing reload idiom (OnboardingGrid loads its own grid in
  // a mount-time effect) -- used after RosterPanel adds/imports a speaker.
  const [refreshKey, setRefreshKey] = useState(0);
  // DEC-662/DEC-746: RosterPanel no longer owns its own trigger button --
  // its "Add speaker" trigger lives in OnboardingGrid's single title action
  // row, and opens this panel via `mode`. CSV import lives on the Contacts
  // page now (RosterPanel's own 'import' mode is unreachable from here).
  const [rosterMode, setRosterMode] = useState<RosterPanelMode>('none');
  // Multi-portal: ?portal=none swaps the grid for the participations no
  // portal covers (Settings · Portals' coverage count links here), and
  // ?portal=<id> narrows the grid to one portal (decision 73).
  const [searchParams, setSearchParams] = useSearchParams();
  const portalParam = searchParams.get('portal');
  const notInPortal = portalParam === 'none';
  const portalId = portalParam && portalParam !== 'none' ? portalParam : null;
  // Multi-portal: sponsor-designed sessions waiting for approval are reached
  // from here (the queue lives under Speakers); the link shows only when
  // some are waiting.
  const { eventId } = useCurrentEvent();
  const sponsorshipsPath = useMemo(() => (eventId ? `/events/${eventId}/sponsorships` : null), [eventId]);
  const sponsorships = useCachedGet<SponsorshipsOverview>(sponsorshipsPath, 'Failed to load sponsorships');
  const waiting = sponsorships.data?.waiting ?? 0;
  const queueLink =
    waiting > 0 ? (
      <Link className="chq-speakers-queue-link" to="/speakers/sponsor-sessions">
        {`${countOf(waiting, 'sponsor session')} waiting for approval ›`}
      </Link>
    ) : null;

  // 'any', 'none' or a portal id, from the toolbar's portal filter
  function setPortalFilter(value: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value === 'any') params.delete('portal');
      else params.set('portal', value);
      return params;
    });
  }

  function handleRosterChanged() {
    setRefreshKey((k) => k + 1);
    setRosterMode('none');
  }

  return (
    <>
      <RosterPanel mode={rosterMode} onClose={() => setRosterMode('none')} onChanged={handleRosterChanged} />
      {notInPortal ? (
        <NotInPortalView onPortalChange={setPortalFilter} onAddSpeaker={() => setRosterMode('add')} />
      ) : (
        // a portal switch remounts the grid: its page and task filter belong
        // to the columns it had
        <OnboardingGrid
          key={`${refreshKey}:${portalId ?? 'any'}`}
          portalId={portalId}
          onAddSpeaker={() => setRosterMode('add')}
          onPortalChange={setPortalFilter}
          headExtra={queueLink}
        />
      )}
    </>
  );
}
