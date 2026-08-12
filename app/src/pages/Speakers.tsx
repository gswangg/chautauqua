import { useState } from 'react';
import { OnboardingGrid } from './speakers/OnboardingGrid';
import { RosterPanel, type RosterPanelMode } from './speakers/RosterPanel';
import './speakers/speakers.css';

export function SpeakersPage() {
  // Bumping this key forces OnboardingGrid to remount and re-fetch, which is
  // this page's existing reload idiom (OnboardingGrid loads its own grid in
  // a mount-time effect) -- used after RosterPanel adds/imports a speaker.
  const [refreshKey, setRefreshKey] = useState(0);
  // DEC-662: RosterPanel no longer owns its own trigger buttons -- its
  // "Add speaker"/"Import CSV" triggers live in OnboardingGrid's single
  // title action row, and open this panel via `mode`.
  const [rosterMode, setRosterMode] = useState<RosterPanelMode>('none');

  function handleRosterChanged() {
    setRefreshKey((k) => k + 1);
    setRosterMode('none');
  }

  return (
    <>
      <RosterPanel mode={rosterMode} onClose={() => setRosterMode('none')} onChanged={handleRosterChanged} />
      <OnboardingGrid
        key={refreshKey}
        onAddSpeaker={() => setRosterMode('add')}
        onImportCsv={() => setRosterMode('import')}
      />
    </>
  );
}
