import { useState } from 'react';
import { OnboardingGrid } from './speakers/OnboardingGrid';
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

  function handleRosterChanged() {
    setRefreshKey((k) => k + 1);
    setRosterMode('none');
  }

  return (
    <>
      <RosterPanel mode={rosterMode} onClose={() => setRosterMode('none')} onChanged={handleRosterChanged} />
      <OnboardingGrid key={refreshKey} onAddSpeaker={() => setRosterMode('add')} />
    </>
  );
}
