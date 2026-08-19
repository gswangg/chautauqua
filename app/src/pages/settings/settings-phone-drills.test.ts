// task-w3-f/DEC-032 (wave-85 amendment): SETTINGS AT 390 (II) -- Call for
// papers, Public pages and Speaker portal phone-drill geometry
// (docs/design/Chautauqua Settings.dc.html:444-477 / :481-506 /
// :510-548). Deliberately `.test.ts`, not `.test.tsx` -- vitest.config.ts's
// include globs only pick up `app/src/**/*.test.ts` and
// `app/src/**/*.render.test.tsx`, so a `.tsx` scan here would run nowhere
// and report nothing (field guide, wave-85 note).
//
// Each describe below cites one verbatim source line from inside its
// frame's span -- never the label line above the frame -- and asserts the
// component/CSS this task built actually renders/declares what that line
// draws. Source-scan style (read the files as text), matching the
// project's existing `.scan.test.ts` convention (see
// nested-edit-drill.scan.test.ts) since a full render of these panels
// needs a live event/apiGet mock this drill-geometry check doesn't need.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const FRAME_PATH = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');
const FRAME_LINES = readFileSync(FRAME_PATH, 'utf8').split('\n');

const CSS_SOURCE = readFileSync(join(HERE, 'settings.css'), 'utf8');
const CFP_SOURCE = readFileSync(join(HERE, 'CallForPapersPanel.tsx'), 'utf8');
const PUBLIC_PAGES_SOURCE = readFileSync(join(HERE, 'PublicPagesPanel.tsx'), 'utf8');
const PORTAL_SOURCE = readFileSync(join(HERE, 'PortalSettingsPanel.tsx'), 'utf8');

/** 1-indexed line lookup, trimmed -- matches how every other citation in
 * this codebase's field guide/comments reads `file.ext:NNN`. */
function frameLine(n: number): string {
  const line = FRAME_LINES[n - 1];
  if (line === undefined) throw new Error(`Chautauqua Settings.dc.html has no line ${n}`);
  return line.trim();
}

/** Extracts the CSS body of the LAST top-level rule matching `selector` in
 * the file -- several of these selectors are declared twice (a desktop
 * definition, then a narrower phone override later in source order, DEC-
 * 385 single-direction); the LAST declaration is always the one closest to
 * the terminal phone block this task appends to, so it's the one whose
 * cascade actually wins at <=700px. Narrow, source-level, no CSS parser
 * dependency (mirrors the project's other topLevelRuleBody-style scans). */
function phoneRuleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'gm');
  const matches = [...css.matchAll(re)];
  const last = matches[matches.length - 1];
  if (!last || last[1] === undefined) throw new Error(`No rule found for ${selector} in settings.css`);
  return last[1];
}

describe('Call for papers phone drill (Chautauqua Settings.dc.html:452)', () => {
  const CITED_LINE = 452;
  const VERBATIM =
    '<div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; padding:0 13px; font-size:14px">chautauqua.cc/submit/devflow-conf-2027</div>';

  it('lands inside the Call for papers frame span (:444-477) and cites the verbatim readout box', () => {
    expect(CITED_LINE).toBeGreaterThanOrEqual(444);
    expect(CITED_LINE).toBeLessThanOrEqual(477);
    expect(frameLine(CITED_LINE)).toBe(VERBATIM);
  });

  it('renders the public link as a chq-settings-readout box, not a bare span', () => {
    expect(CFP_SOURCE).toMatch(/<span className="chq-settings-readout">\{publicLink\}<\/span>/);
  });

  it('boxes chq-settings-readout at the drawn 46px/border/radius/background on phone only', () => {
    const body = phoneRuleBody(CSS_SOURCE, '.chq-settings-readout');
    expect(body).toMatch(/min-height:\s*46px/);
    expect(body).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(body).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    expect(body).toMatch(/background:\s*var\(--chq-surface\)/);
    expect(body).toMatch(/font-size:\s*14px/);
    // Declared exactly once, and after the LAST `@media (max-width: 700px)`
    // opener in the file -- i.e. inside a phone block, never as a
    // top-level (desktop-reaching) rule (DEC-385 single direction).
    const ruleIndex = CSS_SOURCE.indexOf('.chq-settings-readout {');
    const occurrences = CSS_SOURCE.split('.chq-settings-readout {').length - 1;
    expect(occurrences).toBe(1);
    expect(ruleIndex).toBeGreaterThan(CSS_SOURCE.lastIndexOf('@media (max-width: 700px)', ruleIndex));
  });

  it('gives the Copy link pill the drawn 44px full-width phone floor (:453)', () => {
    expect(frameLine(453)).toBe(
      '<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; margin-top:4px">Copy link</span>',
    );
    expect(CFP_SOURCE).toMatch(/className="chq-link-button chq-settings-cfp-copy-btn"/);
    const body = phoneRuleBody(CSS_SOURCE, '.chq-settings-cfp-copy-btn');
    expect(body).toMatch(/width:\s*100%/);
    // The 44px floor itself comes from the existing generic
    // `.chq-settings-panel .chq-link-button` phone rule this button also
    // matches -- assert that shared rule still declares the floor.
    const sharedBody = phoneRuleBody(CSS_SOURCE, '.chq-settings-panel .chq-link-button');
    expect(sharedBody).toMatch(/min-height:\s*44px/);
  });
});

describe('Public pages phone drill (Chautauqua Settings.dc.html:496)', () => {
  const CITED_LINE = 496;
  const VERBATIM =
    '<span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">View</span>';

  it('lands inside the Public pages frame span (:481-506) and cites the verbatim View pill', () => {
    expect(CITED_LINE).toBeGreaterThanOrEqual(481);
    expect(CITED_LINE).toBeLessThanOrEqual(506);
    expect(frameLine(CITED_LINE)).toBe(VERBATIM);
  });

  it('gives View its own phone-only class, never touching the desktop inline-action', () => {
    expect(PUBLIC_PAGES_SOURCE).toMatch(
      /className="chq-settings-inline-action chq-settings-public-pages-view-action"/,
    );
    const body = phoneRuleBody(CSS_SOURCE, '.chq-settings-public-pages-view-action');
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(body).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(body).toMatch(/justify-content:\s*center/);
  });

  it('flexes View and Embed code as equal flex:1 pills sharing one row (:496-497)', () => {
    expect(frameLine(497)).toBe(
      '<span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Embed code</span>',
    );
    const rowBody = phoneRuleBody(CSS_SOURCE, '.chq-settings-public-pages-row');
    expect(rowBody).toMatch(/'view embed'/);
    const viewBody = phoneRuleBody(CSS_SOURCE, '.chq-settings-public-pages-view-action');
    expect(viewBody).toMatch(/grid-area:\s*view/);
    const embedBody = phoneRuleBody(CSS_SOURCE, '.chq-settings-public-pages-embed-action');
    expect(embedBody).toMatch(/grid-area:\s*embed/);
    expect(embedBody).toMatch(/width:\s*100%/);
  });

  it('never renders the deferred Publish/Unpublish control drawn at :495, disabled or otherwise', () => {
    expect(frameLine(495)).toBe(
      '<span style="flex:1; border:1px solid #CFC7B7; border-radius:6px; background:#EFEBDF; color:#2E2A24; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">{{ p.toggle }}</span>',
    );
    // Naming the deferred control in a comment is fine (the deviation
    // note above quotes the frame's own `{{ p.toggle }}` binding, and the
    // section head's real "Unpublishing returns 404" consequence copy is
    // unrelated user-facing text) -- strip comments first, then assert no
    // LIVE `.toggle` field read or publish/unpublish handler exists.
    const codeOnly = PUBLIC_PAGES_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/\.toggle\b/);
    expect(codeOnly).not.toMatch(/onClick=\{[^}]*[Pp]ublish/);
    expect(codeOnly).not.toMatch(/function\s+\w*[Pp]ublish/);
  });
});

describe('Speaker portal phone drill (Chautauqua Settings.dc.html:523)', () => {
  const CITED_LINE = 523;
  const VERBATIM =
    '<span style="background:#4E5C31; color:#F7F9F0; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Bio</span>';

  it('lands inside the Speaker portal frame span (:510-548) and cites the verbatim active pill', () => {
    expect(CITED_LINE).toBeGreaterThanOrEqual(510);
    expect(CITED_LINE).toBeLessThanOrEqual(548);
    expect(frameLine(CITED_LINE)).toBe(VERBATIM);
  });

  it('renders the same SpeakerEditPills list the frame draws (Bio/Headshot/Links active, Title/Abstract outlined)', () => {
    expect(PORTAL_SOURCE).toMatch(/label: 'Bio', editable: true/);
    expect(PORTAL_SOURCE).toMatch(/label: 'Headshot', editable: true/);
    expect(PORTAL_SOURCE).toMatch(/label: 'Links', editable: true/);
    expect(PORTAL_SOURCE).toMatch(/label: 'Session title', editable: false/);
    expect(PORTAL_SOURCE).toMatch(/label: 'Abstract', editable: false/);
    expect(PORTAL_SOURCE).toMatch(
      /className=\{field\.editable \? 'chq-pill chq-pill-static is-active' : 'chq-pill chq-pill-static'\}/,
    );
  });

  it('reaches the drawn 44px pill floor via the shared .chq-pill phone rule (styles.css, not re-declared here)', () => {
    const stylesPath = join(HERE, '..', '..', 'styles.css');
    const stylesSource = readFileSync(stylesPath, 'utf8');
    // .chq-pill sits in the shared phone-floor list alongside chq-rail-link
    // etc. -- assert the rule this panel depends on still declares it,
    // without this task re-declaring (and risking drifting from) it.
    expect(stylesSource).toMatch(/\.chq-pill,\s*\n\s*\.chq-rail-link,[\s\S]{0,300}min-height:\s*44px;/);
  });
});

describe('Settings phone read-row label register (Chautauqua Settings.dc.html:451)', () => {
  it('cites the Public link eyebrow label verbatim inside the CFP frame span', () => {
    expect(frameLine(451)).toBe(
      '<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Public link</span>',
    );
  });

  it('gives every SummarySection read-row label this eyebrow register on phone only', () => {
    const body = phoneRuleBody(CSS_SOURCE, '.chq-settings-row-label');
    expect(body).toMatch(/font-size:\s*11px/);
    expect(body).toMatch(/font-weight:\s*800/);
    expect(body).toMatch(/text-transform:\s*uppercase/);
    expect(body).toMatch(/letter-spacing:\s*0\.1em/);
  });
});
