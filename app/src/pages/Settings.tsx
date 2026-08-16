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
//
// DEC-728 amendment (wave 13): a settings section URL must render that
// section on a phone. The phone drill selection ('active') is now SEEDED
// from and kept IN SYNC with the same `?section=` URL param SummarySection
// already writes (openEdit) so /admin/settings?section=cfp&edit=1 -- a URL
// the product mints and a user can bookmark or be linked to -- actually
// renders the CFP panel instead of just the rail. `selectSection` (an
// explicit rail click) now ALSO pushes `section=<key>` so the device Back
// button leaves a drilled section; the IntersectionObserver's own
// scroll-driven `setActive` calls stay local component state only -- a
// highlight that follows the reader's scroll must never write history.
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  { key: 'tracks-rooms', label: 'Tracks and rooms', Panel: TracksRoomsPanel },
  { key: 'public-pages', label: 'Public pages', Panel: PublicPagesPanel },
  { key: 'portal', label: 'Speaker portal', Panel: PortalSettingsPanel },
  // G13 fidelity: frames 09--10..16 draw the rail as ... Speaker portal,
  // Your data, People and roles -- Your data comes BEFORE People and roles.
  { key: 'your-data', label: 'Your data', Panel: YourDataPanel },
  { key: 'people', label: 'People and roles', Panel: PeopleRolesPanel },
];

export function SettingsPage() {
  // Mobile-only drill-in selection AND (DEC-896) the desktop rail's
  // click-authoritative highlight. Ignored by the desktop layout for
  // drilling (CSS keeps every section visible there) but still drives
  // which rail link is marked active there. Never touches history/
  // location -- an explicit click wins immediately; once the reader
  // scrolls, the IntersectionObserver below takes over deciding which
  // section is "active" until the next click.
  const [searchParams, setSearchParams] = useSearchParams();
  const validKeys = SECTIONS.map((s) => s.key);
  const rawUrlSection = searchParams.get('section');
  const urlSection = rawUrlSection !== null && validKeys.includes(rawUrlSection) ? rawUrlSection : null;

  const [active, setActive] = useState<string | null>(urlSection);

  // DEC-728 amendment (wave 49): a settings section URL carrying `edit=1`
  // (SummarySection's openEdit) is a SCREEN, not a scroll target -- only
  // that one panel mounts inside .chq-settings-content, the page's own
  // title becomes that section's label, and the tertiary back control
  // (already wired to clearSection below) becomes reachable at desktop
  // too. Read mode (no edit param) is unchanged: all seven panels, one
  // static document, rail click scrolls and never hides.
  const editing = urlSection !== null && searchParams.get('edit') === '1';
  const editingSection = editing ? SECTIONS.find((section) => section.key === urlSection) : undefined;
  const sectionsToRender = editingSection ? [editingSection] : SECTIONS;
  const pageTitle = editingSection ? editingSection.label : 'Settings';

  // Keep `active` in sync whenever the URL's `section` param CHANGES (e.g.
  // navigating directly to /settings?section=cfp, or Back/Forward) without
  // clobbering the IntersectionObserver's own local setActive calls on
  // every render -- only re-seed when urlSection itself moves.
  const lastUrlSectionRef = useRef(urlSection);
  useEffect(() => {
    if (urlSection !== lastUrlSectionRef.current) {
      lastUrlSectionRef.current = urlSection;
      setActive(urlSection);
    }
  }, [urlSection]);

  // DEC-896: an explicit rail click is authoritative until the next
  // scroll settles -- suppress observer-driven updates for a moment after
  // a click so the section being scrolled TO isn't immediately clobbered
  // by whatever's still onscreen mid-scroll.
  const suppressObserverRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function selectSection(key: string) {
    setActive(key);
    lastUrlSectionRef.current = key;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('section', key);
      return params;
    });
    suppressObserverRef.current = true;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      suppressObserverRef.current = false;
    }, 600);
    const el = document.getElementById(`chq-settings-section-${key}`);
    // jsdom (test env) doesn't implement scrollIntoView; real browsers do.
    el?.scrollIntoView?.({ block: 'start' });
  }

  function clearSection() {
    setActive(null);
    lastUrlSectionRef.current = null;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('section');
      params.delete('edit');
      return params;
    });
  }

  // DEC-896: the rail follows the reader -- once the page scrolls, the
  // active link tracks whichever section is actually most visible instead
  // of freezing on the first one ever clicked. Guarded behind a feature
  // check since jsdom (test env) has no IntersectionObserver; render
  // tests exercise click-driven highlighting only, unaffected.
  useEffect(() => {
    // Only one section is mounted while editing -- there is nothing for a
    // scroll-driven highlight to observe, and the panel being edited must
    // not lose `active` to an observer racing against a single element.
    if (editingSection) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const elements = SECTIONS.map((section) => document.getElementById(`chq-settings-section-${section.key}`)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (elements.length === 0) return undefined;
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = entry.target.id.replace('chq-settings-section-', '');
          ratios.set(key, entry.intersectionRatio);
        }
        if (suppressObserverRef.current) return;
        let topKey: string | null = null;
        let topRatio = 0;
        for (const section of SECTIONS) {
          const ratio = ratios.get(section.key) ?? 0;
          if (ratio > topRatio) {
            topRatio = ratio;
            topKey = section.key;
          }
        }
        if (topKey) setActive(topKey);
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [editingSection]);

  return (
    <div className="chq-page chq-settings-page">
      <h1 className="chq-page-title">{pageTitle}</h1>
      <div className="chq-settings-layout" data-drilled={active !== null} data-editing={editing}>
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
              aria-current={active === section.key ? 'true' : undefined}
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
            onClick={clearSection}
          >
            &lsaquo; Settings
          </button>
          {sectionsToRender.map((section) => {
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
