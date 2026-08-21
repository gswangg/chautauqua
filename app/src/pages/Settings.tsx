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
import { DEC_728 } from '../../../src/decisions';
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
  // DEC-032 w85 amendment: the phone landing (Chautauqua Settings.dc.html
  // :275-312) is a one-column list of panel groups, each with a 13px muted
  // detail line under its label -- not the desktop rail's label alone.
  // Prose, not live data (DEC-650): describes what the section holds, no
  // counts that could drift from the record.
  // w4-e/DEC-375 states the same field from the index-row side: it is the
  // phone index row's detail line (`{{ g.detail }}` at :275). Desktop never
  // reads it -- the rail there is the plain link it always was.
  detail: string;
  Panel: ComponentType;
  // DEC-896 wave-130 amendment: the pack's B10 edit views draw an H1 naming
  // the EDIT ("Edit the form", "Edit the event", ...) while the back link
  // above it names the SECTION -- the opposite split from the section-label
  // pageTitle this file used for both. Present for exactly the six sections
  // with an edit view; 'public-pages' has none (the pack drops its edit
  // view -- DEVIATIONS §6 defers the :1046 saved-embed drill).
  editTitle?: string;
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
  {
    key: 'event',
    label: 'Event',
    detail: 'Dates, location, timezone, and capacity',
    Panel: EventSettingsPanel,
    // Chautauqua Settings.dc.html:724 `Edit the event`.
    editTitle: 'Edit the event',
  },
  {
    key: 'cfp',
    label: 'Call for papers',
    detail: 'Submission window, formats, and custom questions',
    Panel: CallForPapersPanel,
    // Chautauqua Settings.dc.html:633 `Edit the form`.
    editTitle: 'Edit the form',
  },
  {
    key: 'tracks-rooms',
    label: 'Tracks and rooms',
    detail: 'The tracks and rooms sessions can be assigned to',
    Panel: TracksRoomsPanel,
    // Chautauqua Settings.dc.html:814 `Edit tracks and rooms`.
    editTitle: 'Edit tracks and rooms',
  },
  {
    key: 'public-pages',
    label: 'Public pages',
    detail: 'Which public pages are live, and their embed codes',
    Panel: PublicPagesPanel,
    // No editTitle: the pack drops an edit view for this section
    // (DEVIATIONS §6 defers the :1046 saved-embed drill).
  },
  {
    key: 'portal',
    label: 'Speaker portal',
    detail: 'What speakers see once they sign in',
    Panel: PortalSettingsPanel,
    // Chautauqua Settings.dc.html:895 `Edit the speaker portal`.
    editTitle: 'Edit the speaker portal',
  },
  // G13 fidelity: frames 09--10..16 draw the rail as ... Speaker portal,
  // Your data, People and roles -- Your data comes BEFORE People and roles.
  {
    key: 'your-data',
    label: 'Your data',
    detail: 'Exports, API tokens, and API docs',
    Panel: YourDataPanel,
    // Chautauqua Settings.dc.html:1137 `Edit your data settings`.
    editTitle: 'Edit your data settings',
  },
  {
    key: 'people',
    label: 'People and roles',
    detail: 'Organizers and reviewers on this event',
    Panel: PeopleRolesPanel,
    // Chautauqua Settings.dc.html:976 `Edit people and roles`.
    editTitle: 'Edit people and roles',
  },
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

  // DEC-728 wave-157 (Saved embeds :578): a THIRD phone drill state, layered
  // on top of the plain public-pages read-drill -- `?section=public-pages
  // &view=embeds` swaps the drilled screen's content from the surface-list
  // read-drill to just SavedEmbedsPanel, with its own H1/back/summary. The
  // `view=` param is PHONE-ONLY (DEC_728): this file's own header states
  // the desktop rail never hides sections, so nothing here filters
  // `sectionsToRender` for it -- only settings.css's terminal phone block
  // (guarded by a data attribute below) ever hides anything because of it,
  // exactly the same DEC-385 narrow-overrides-wide idiom `data-editing`
  // already uses for the edit drill.
  void DEC_728;
  const embedsView = urlSection === 'public-pages' && searchParams.get('view') === 'embeds';

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
  // w4-e/DEC-375 wave-86: phone renders the index OR one drilled section,
  // never both -- the desktop rail-click highlight already tracks `active`
  // (DEC-896), so a drilled phone screen's title is the SAME state, just a
  // section label instead of 'Settings'. This is a phone-only twin of
  // `pageTitle` (below, `.chq-settings-drill-title`, CSS-hidden at desktop
  // in settings.css's trailing phone block) -- reusing `pageTitle` itself
  // for phone would also retitle the DESKTOP page the moment a reader
  // scrolls (data-drilled tracks the same `active`), which is exactly the
  // "rail click only scrolls, never hides" invariant this file's own header
  // comment states. `editingSection` already covers the edit-drill case;
  // `active` covers the plain read-drill case the phone index taps into.
  const activeSection = active !== null ? SECTIONS.find((section) => section.key === active) : undefined;
  // DEC-896 wave-130 amendment: an edit view's H1 names the EDIT
  // (editTitle), not the section -- the section name moves to the back
  // control below. A plain read-drill (active, not editing) still titles
  // the page with the section label; the index keeps 'Settings'.
  // DEC-728 wave-157 amendment: the embeds-view screen's H1 is 'Saved
  // embeds' -- reusing this SAME pageTitle/phoneDrillTitle machinery (not a
  // second title mechanism) is exactly what the ruling requires.
  const pageTitle = embedsView
    ? 'Saved embeds'
    : editingSection
      ? editingSection.editTitle
      : (activeSection?.label ?? 'Settings');
  // DEC-393/DESIGN-RULINGS:247 amendment (w13-i): the edit-drill case needs
  // this same phone-only twin too -- the ORIGINAL top-level h1 (pageTitle,
  // above) sits BEFORE .chq-settings-layout in the DOM, so it always paints
  // above the `‹ back` control that lives inside .chq-settings-content; the
  // frame draws back ABOVE the H1. Rendering the twin for editingSection as
  // well (and hiding the original top h1 at phone whenever either drill
  // state is active, in settings.css) puts back first in DOM/paint order
  // for both the plain read-drill and the edit-drill screens.
  // w7-c/DEC-728 amendment: Chautauqua Settings.dc.html:723-724 draws this
  // same back-above-H1 order inside the content COLUMN at desktop too
  // (:632-633, :813-814, :894-895, :975-976, :1136-1137) -- so this twin is
  // no longer phone-only. settings.css now also hides the original top h1
  // and reveals this twin at desktop, but ONLY while editing
  // ([data-editing='true']); the plain read-drill's desktop rendering is
  // unchanged (top h1 stays visible there, this twin stays display:none) --
  // that case was never named by the frame as needing the swap.
  const phoneDrillTitle = active !== null ? pageTitle : undefined;

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

  // DEC-728 wave-157 amendment: the embeds-view screen's back control names
  // the section it drilled FROM (DESIGN-RULINGS.md:247), '‹ Public pages',
  // and returns to that section's plain read-drill -- drop `view` only,
  // `section` stays `public-pages` so the surface-list screen is what
  // renders next, exactly the edit-drill's own drop-one-param shape below.
  function clearEmbedsView() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('view');
      return params;
    });
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
    // data-drilled repeated on this wrapper (not just .chq-settings-layout
    // below) because the page's own <h1> sits BEFORE .chq-settings-layout
    // in the DOM -- a descendant selector rooted on .chq-settings-layout
    // can never reach it. Phone-only 26px drill H1 register (DEC-643
    // wave-83 amendment) reads this attribute in settings.css.
    <div className="chq-page chq-settings-page" data-drilled={active !== null}>
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
              // Accessible name stays the bare label: the phone-only
              // "Open"/detail text below is presentational furniture, not
              // part of what a screen reader announces for this control,
              // and existing rail-link queries key on the label alone.
              aria-label={section.label}
              onClick={() => selectSection(section.key)}
            >
              {/* DEC-032 w85 amendment: the phone landing (Chautauqua
                  Settings.dc.html :275-312) is a one-column list of panel
                  groups -- label + Open on one line, a muted detail line
                  below. The `-row`/`-open`/`-detail` children render only
                  at phone widths (display:none by default, DEC-385 narrow
                  override); the desktop rail keeps rendering the label
                  alone, unchanged. */}
              <span className="chq-settings-rail-link-row">
                <span className="chq-settings-rail-link-label">{section.label}</span>
                <span className="chq-settings-rail-link-open">Open</span>
              </span>
              <span className="chq-settings-rail-link-detail">{section.detail}</span>
            </button>
          ))}
          {/* Frame's closing sentence (:307-309): plain text, never the
              disabled token -- Embed codes aren't a control here, they're
              a fact about the device. Phone-only, same override shape. */}
          <p className="chq-settings-rail-note">Embed codes are easier to copy on a laptop</p>
        </nav>
        <div className="chq-settings-content">
          {/* DEC-896 wave-130 amendment: an edit view's back control names
              the SECTION, not 'Settings' -- Chautauqua Settings.dc.html
              :632 `‹ Call for papers`, :723 `‹ Event`, :813 `‹ Tracks and
              rooms`, :894 `‹ Speaker portal`, :975 `‹ People and roles`,
              :1136 `‹ Your data` -- and it returns to the section's
              read-drill (`?section=<key>`, editing is pure URL state,
              dropping `edit=1`), not all the way to the section index. The
              plain read-drill keeps its existing `‹ Settings` + clearSection
              back-to-index control. */}
          <button
            type="button"
            className="chq-btn chq-btn-tertiary chq-settings-back"
            onClick={
              editingSection
                ? () =>
                    setSearchParams((prev) => {
                      const params = new URLSearchParams(prev);
                      params.set('section', editingSection.key);
                      params.delete('edit');
                      return params;
                    })
                : embedsView
                  ? clearEmbedsView
                  : clearSection
            }
          >
            &lsaquo; {editingSection ? editingSection.label : embedsView ? 'Public pages' : 'Settings'}
          </button>
          {phoneDrillTitle ? (
            // w4-e/DEC-375: phone-only twin of the page h1 (settings.css
            // hides this at desktop and hides the page-level h1 at phone
            // whenever a section is drilled, so exactly one title is ever
            // visible in either mode).
            <h1 className="chq-page-title chq-settings-drill-title">{phoneDrillTitle}</h1>
          ) : null}
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
                // DEC-728 wave-157 amendment: only public-pages ever carries
                // this attribute (embedsView can only be true when
                // urlSection === 'public-pages') -- settings.css's terminal
                // phone block reads it to swap the drilled screen's content;
                // every other section's wrapper is untouched.
                {...(section.key === 'public-pages' ? { 'data-embeds-view': embedsView } : {})}
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
