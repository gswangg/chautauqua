// The Settings sub-pages multi-portal adds (Portals frame, flows 1, 2 and 5:
// /settings/portals, /settings/portals/:portalId, /settings/portals/library,
// /settings/sponsorships). "Manage portals" opens a page of its own beside
// the same section rail, the way a section's edit view does (Settings.tsx's
// ?section=&edit=1 drill): back control above the H1, rail at desktop, the
// page alone at phone. It reuses that drill's classes and hooks
// (data-drilled / data-editing, .chq-settings-back, .chq-settings-drill-title)
// rather than minting a second shell, and widens the content column for
// the tables these pages draw.
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SECTIONS } from '../Settings';
import { guardedNavigate } from '../../lib/useNavExceptions';
import '../settings/settings.css';
import './portals.css';

export interface SettingsSubPageProps {
  // the rail entry this page belongs to ('portal' or 'sponsorships')
  sectionKey: string;
  back: { label: string; to: string };
  title: string;
  // right-aligned beside the H1 ("New portal", "New tier")
  actions?: ReactNode;
  // a line under the H1 ("14 saved · rule edited")
  subtitle?: ReactNode;
  children: ReactNode;
}

export function SettingsSubPage({ sectionKey, back, title, actions, subtitle, children }: SettingsSubPageProps) {
  const navigate = useNavigate();
  return (
    <div className="chq-page chq-settings-page chq-settings-subpage chq-measure-table" data-drilled="true">
      <h1 className="chq-page-title">{title}</h1>
      <div className="chq-settings-layout" data-drilled="true" data-editing="true">
        <nav className="chq-rail chq-settings-rail" aria-label="Settings sections">
          {SECTIONS.map((section) => (
            // the same rail buttons Settings.tsx draws, each opening its
            // section on the Settings page (through the app's leave guard,
            // so an editor with unsaved edits asks first)
            <button
              key={section.key}
              type="button"
              className={
                section.key === sectionKey
                  ? 'chq-rail-link chq-settings-rail-link chq-settings-rail-link-active'
                  : 'chq-rail-link chq-settings-rail-link'
              }
              aria-current={section.key === sectionKey ? 'true' : undefined}
              aria-label={section.label}
              onClick={() => guardedNavigate(() => navigate(`/settings?section=${section.key}`))}
            >
              <span className="chq-settings-rail-link-row">
                <span className="chq-settings-rail-link-label">{section.label}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="chq-settings-content">
          <Link to={back.to} className="chq-btn chq-btn-tertiary chq-settings-back">
            &lsaquo; {back.label}
          </Link>
          <div className="chq-subpage-head">
            <div className="chq-subpage-titles">
              <h1 className="chq-page-title chq-settings-drill-title">{title}</h1>
              {subtitle ? <p className="chq-subpage-sub">{subtitle}</p> : null}
            </div>
            {actions ? <div className="chq-subpage-actions">{actions}</div> : null}
          </div>
          <div className="chq-settings-section chq-settings-section-active">{children}</div>
        </div>
      </div>
    </div>
  );
}
