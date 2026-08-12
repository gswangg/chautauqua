// Settings (w2-f, DEC-375): one route, no URL-level subscreens. Desktop
// matches docs/design/Chautauqua Settings.dc.html lines 51-59 — a sticky
// 196px section rail beside a single 760px-max scrolling column of every
// panel. Below 700px the rail becomes a full-width list; picking a section
// swaps in just that panel with a tertiary back control. Both states are
// driven by one piece of component state (`active`) — no URL change, no
// history entry, no new route. Every panel keeps its frozen (DEC-366) save
// endpoint, token reveal-once flow, delete-reference guards, export and
// embed-snippet generation exactly as-is.
import { useState, type ComponentType } from 'react';
import { EventSettingsPanel } from './settings/EventSettingsPanel';
import { CallForPapersPanel } from './settings/CallForPapersPanel';
import { TracksRoomsPanel } from './settings/TracksRoomsPanel';
import { PortalSettingsPanel } from './settings/PortalSettingsPanel';
import { ResourcesPanel } from './settings/ResourcesPanel';
import { PeopleRolesPanel } from './settings/PeopleRolesPanel';
import { ApiTokensPanel } from './settings/ApiTokensPanel';
import { ExportsPanel } from './settings/ExportsPanel';
import { EmbedsPanel } from './settings/EmbedsPanel';
import './settings/settings.css';

interface SettingsSection {
  key: string;
  label: string;
  Panel: ComponentType;
}

// DEC-588: rail order is Event, Call for papers, Portal, Tracks and rooms,
// Resources, People and roles, API tokens, Exports, Embeds.
const SECTIONS: SettingsSection[] = [
  { key: 'event', label: 'Event', Panel: EventSettingsPanel },
  { key: 'cfp', label: 'Call for papers', Panel: CallForPapersPanel },
  { key: 'portal', label: 'Portal', Panel: PortalSettingsPanel },
  { key: 'tracks', label: 'Tracks and rooms', Panel: TracksRoomsPanel },
  { key: 'resources', label: 'Resources', Panel: ResourcesPanel },
  { key: 'people', label: 'People and roles', Panel: PeopleRolesPanel },
  { key: 'tokens', label: 'API tokens', Panel: ApiTokensPanel },
  { key: 'exports', label: 'Exports', Panel: ExportsPanel },
  { key: 'embeds', label: 'Embeds', Panel: EmbedsPanel },
];

export function SettingsPage() {
  // Mobile-only drill-in selection. Ignored by the desktop layout (CSS
  // keeps every section visible there); on phone it toggles which single
  // section is shown. Never touches history/location.
  const [active, setActive] = useState<string | null>(null);

  function selectSection(key: string) {
    setActive(key);
    const el = document.getElementById(`chq-settings-section-${key}`);
    // jsdom (test env) doesn't implement scrollIntoView; real browsers do.
    el?.scrollIntoView?.({ block: 'start' });
  }

  return (
    <div className="chq-page chq-settings-page">
      <h1 className="chq-page-title">Settings</h1>
      <p className="chq-settings-account-link">
        <a href="/account/password">Change password</a>
      </p>
      <div className="chq-settings-layout" data-drilled={active !== null}>
        <nav className="chq-rail chq-settings-rail" aria-label="Settings sections">
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              className={
                active === section.key
                  ? 'chq-rail-link chq-settings-rail-link chq-settings-rail-link-active'
                  : 'chq-rail-link chq-settings-rail-link'
              }
              onClick={() => selectSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </nav>
        <div className="chq-settings-content">
          <button
            type="button"
            className="chq-btn chq-btn-tertiary chq-settings-back"
            onClick={() => setActive(null)}
          >
            &lsaquo; Settings
          </button>
          {SECTIONS.map((section) => {
            const Panel = section.Panel;
            return (
              <div
                key={section.key}
                id={`chq-settings-section-${section.key}`}
                className={
                  active === section.key
                    ? 'chq-settings-section chq-settings-section-active'
                    : 'chq-settings-section'
                }
              >
                <Panel />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
