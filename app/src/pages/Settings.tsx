import { EventSettingsPanel } from './settings/EventSettingsPanel';
import { TracksRoomsPanel } from './settings/TracksRoomsPanel';
import { PortalSettingsPanel } from './settings/PortalSettingsPanel';
import { ResourcesPanel } from './settings/ResourcesPanel';
import { ApiTokensPanel } from './settings/ApiTokensPanel';
import { ExportsPanel } from './settings/ExportsPanel';
import { EmbedsPanel } from './settings/EmbedsPanel';

export function SettingsPage() {
  return (
    <div className="chq-page">
      <h1>Settings</h1>
      <p>
        <a href="/account/password">Change password</a>
      </p>
      <EventSettingsPanel />
      <TracksRoomsPanel />
      <PortalSettingsPanel />
      <ResourcesPanel />
      <ApiTokensPanel />
      <ExportsPanel />
      <EmbedsPanel />
    </div>
  );
}
