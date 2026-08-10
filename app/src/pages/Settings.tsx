import { ApiTokensPanel } from './settings/ApiTokensPanel';
import { ExportsPanel } from './settings/ExportsPanel';

export function SettingsPage() {
  return (
    <div className="chq-page">
      <h1>Settings</h1>
      <ApiTokensPanel />
      <ExportsPanel />
    </div>
  );
}
