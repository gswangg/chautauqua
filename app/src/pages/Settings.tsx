// Settings (w2-f, DEC-375; DEC-728 w1-b): the section rail is a static
// one-document at desktop — matches docs/design/Chautauqua Settings.dc.html
// lines 51-59, a sticky 196px rail beside a single 760px-max scrolling
// column of every panel — a rail click only scrolls to its section and
// highlights it, it never hides sections there (no desktop drill). Below
// 700px only, the rail becomes a full-width list and picking a section
// swaps in just that panel with a tertiary back control; that mobile
// single-panel mode is driven by one piece of component state (`active`)
// scoped entirely to the @media block in settings.css — no URL change, no
// history entry, no new route.
//
// This is orthogonal to each panel's own DEC-728 summary/edit drill, which
// IS URL state (`?section=<key>&edit=1`, see SummarySection.tsx) so a
// section's edit form is bookmarkable and Back leaves it; that drill lives
// inside each panel, not here. Every panel keeps its frozen (DEC-366) save
// endpoint, token reveal-once flow, delete-reference guards, export and
// embed-snippet generation exactly as-is.
import { useState, type ComponentType } from 'react';
import { EventSettingsPanel } from './settings/EventSettingsPanel';
import { CallForPapersPanel } from './settings/CallForPapersPanel';
import { TracksRoomsPanel } from './settings/TracksRoomsPanel';
import { PublicPagesPanel } from './settings/PublicPagesPanel';
import { PortalSettingsPanel } from './settings/PortalSettingsPanel';
import { PeopleRolesPanel } from './settings/PeopleRolesPanel';
import { YourDataPanel } from './settings/YourDataPanel';
import './settings/settings.css';

export interface SettingsSection {
  key: string;
  label: string;
  Panel: ComponentType;
}

// DEC-747: 'Speaker portal' is now ONE read-view section rendered entirely
// by PortalSettingsPanel (its Resources row delegates to ResourcesPanel
// internally) -- no separate wrapper needed.

// DEC-747/DEC-691: rail converges on exactly the mock's seven sections
// (docs/design/Chautauqua Settings.dc.html lines 61-233), in this order.
// 'Import from Sessionboard' is no longer an eighth top-level rail entry --
// it's a row inside 'Your data' (YourDataPanel) that drills into the same
// SessionboardImportPanel, unchanged.
export const SECTIONS: SettingsSection[] = [
  { key: 'event', label: 'Event', Panel: EventSettingsPanel },
  { key: 'cfp', label: 'Call for papers', Panel: CallForPapersPanel },
  { key: 'tracks', label: 'Tracks and rooms', Panel: TracksRoomsPanel },
  { key: 'public-pages', label: 'Public pages and embeds', Panel: PublicPagesPanel },
  { key: 'portal', label: 'Speaker portal', Panel: PortalSettingsPanel },
  { key: 'people', label: 'People and roles', Panel: PeopleRolesPanel },
  { key: 'your-data', label: 'Your data', Panel: YourDataPanel },
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
