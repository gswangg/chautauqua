import { useState } from 'react';
import { OnboardingGrid } from './speakers/OnboardingGrid';
import { RosterPanel } from './speakers/RosterPanel';

export function SpeakersPage() {
  // Bumping this key forces OnboardingGrid to remount and re-fetch, which is
  // this page's existing reload idiom (OnboardingGrid loads its own grid in
  // a mount-time effect) -- used after RosterPanel adds/imports a speaker.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <RosterPanel onChanged={() => setRefreshKey((k) => k + 1)} />
      <OnboardingGrid key={refreshKey} />
    </>
  );
}
