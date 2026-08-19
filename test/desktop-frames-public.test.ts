// Desktop-frame parity claims: the PUBLIC half of the Public-and-Portal
// cluster (DEC-976, v12 mobile campaign wave 21, task v12m-w3-s).
//
// test/desktop-frame-ledger.scan.test.ts lists 13 unclaimed desktop frames
// in `docs/design/Chautauqua Public and Portal.dc.html`. This task claims
// the 7 PUBLIC ones (:28 Sessions and agenda, :132 Agenda, :249 Agenda · a
// track highlighted, :680 Speakers · list view, :730 Speakers · grid view,
// :779 My schedule, :894 Submit a talk). The remaining 6 -- :1101 CFP
// closed, :1167 Public sessions · nothing published, :1211 Submit a talk ·
// rejected on submit, :1373 Portal · Edit your session · desktop, :1473
// Portal preview, :1532 CFP not open yet -- are the PORTAL/refusal half of
// this same cluster and are explicitly OUT OF SCOPE here, scheduled for a
// later wave (not dropped -- see docs/design/audit/desktop-frame-ledger-v12.md's
// "Divergences found while claiming" section, filed by this same task).
//
// Node tier: readFileSync over sources only, no jsdom, no render (per the
// task charter). Implementation roots: src/routes/public/** and
// src/routes/public/css/** (agenda.css.ts, cards.css.ts, chrome.css.ts,
// rail.css.ts), plus src/routes/public/cfp.css.ts for the CFP form (:894).
//
// Receipt shape (DEC-976 wave-87/102 idiom, mirrored here since this file's
// citations are to DESKTOP frames, which app/src/frame-citation.scan.test.ts's
// own executable contract does not yet cover -- that block is scoped to
// PHONE (width:390px/height:844) frames only): each it() below carries a
// strict `docs/design/Chautauqua Public and Portal.dc.html:<line>` citation
// immediately followed by a backtick-quoted literal copied VERBATIM from
// that exact frame line, with a real `expect(` about the app tree within a
// few source lines beneath -- never a file-header inventory, never a
// tautology comparing the frame to itself (app/src/tautological-assertion.
// scan.test.ts's population; this file adds nothing to it).
//
// DEC-990 rules /e/:slug/gallery is the GRID VIEW of one Speakers surface,
// not a nav destination -- so :680 (list) and :730 (grid) are two views of
// the SAME module (src/routes/public/speakers.tsx), switched by the
// `active: "speakers" | "gallery"` prop SpeakerViewToggle takes (itself
// driven by which of the two surface paths, /speakers or /gallery, the
// request dispatched to -- src/routes/public/dispatch.tsx's SURFACES/
// dispatchPublicSurface). See the dedicated assertion below.
//
// DESKTOP IS FROZEN: this task changes no CSS/TSX, tests only. Two real
// numeric divergences the frame draws that the shipped tree does not were
// found while writing these claims and are filed (not asserted around) in
// docs/design/audit/desktop-frame-ledger-v12.md -- the gallery grid's 18px
// vs 16px gap, and the wide-shell chrome's 44px/40px vs 34px/34px padding
// (1268px vs 1248px content max-width). Neither number is asserted here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const SRC_PUBLIC = join(REPO_ROOT, 'src', 'routes', 'public');

const FRAME_FILE = 'Chautauqua Public and Portal.dc.html';

function frameLine(line: number): string {
  const lines = readFileSync(join(DESIGN_ROOT, FRAME_FILE), 'utf-8').split('\n');
  const text = lines[line - 1];
  if (text === undefined) throw new Error(`${FRAME_FILE} has no line ${line}`);
  return text;
}

function read(...parts: string[]): string {
  return readFileSync(join(SRC_PUBLIC, ...parts), 'utf-8');
}

describe('desktop frame parity: Public and Portal, PUBLIC half (DEC-976 wave 21, task v12m-w3-s)', () => {
  it('sanity: each cited frame line still carries the quoted literal (guards a re-cut pack silently moving a line)', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:28 `Sessions and agenda · 1600`
    expect(frameLine(28)).toContain('Sessions and agenda · 1600');
    // docs/design/Chautauqua Public and Portal.dc.html:132 `Agenda · 1600`
    expect(frameLine(132)).toContain('Agenda · 1600');
    // docs/design/Chautauqua Public and Portal.dc.html:249 `Agenda · a track highlighted`
    expect(frameLine(249)).toContain('Agenda · a track highlighted');
    // docs/design/Chautauqua Public and Portal.dc.html:680 `Speakers · list view`
    expect(frameLine(680)).toContain('Speakers · list view');
    // docs/design/Chautauqua Public and Portal.dc.html:730 `Speakers · grid view`
    expect(frameLine(730)).toContain('Speakers · grid view');
    // docs/design/Chautauqua Public and Portal.dc.html:779 `My schedule · /e/:slug/schedule`
    expect(frameLine(779)).toContain('My schedule · /e/:slug/schedule');
    // docs/design/Chautauqua Public and Portal.dc.html:894 `Submit a talk · /submit/:slug`
    expect(frameLine(894)).toContain('Submit a talk · /submit/:slug');
  });

  it(':28 Sessions and agenda · 1600 -- the list+300px-rail pair with a 60px gap is `.chq-pub-sessions-layout`', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:48 `grid-template-columns:minmax(0, 820px) 300px; gap:60px`
    expect(frameLine(48)).toContain('grid-template-columns:minmax(0, 820px) 300px; gap:60px');
    const rail = read('css', 'rail.css.ts');
    expect(rail).toContain('.chq-pub-sessions-layout');
    expect(rail).toMatch(/\.chq-pub-sessions-layout\s*\{[^}]*grid-template-columns:\s*1fr 300px;[^}]*gap:\s*60px;/s);
  });

  it(':132 Agenda · 1600 -- the same list+300px-rail 60px-gap pair, as `.chq-pub-agenda-layout`', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:151 `grid-template-columns:minmax(0, 820px) 300px; gap:60px`
    expect(frameLine(151)).toContain('grid-template-columns:minmax(0, 820px) 300px; gap:60px');
    const rail = read('css', 'rail.css.ts');
    expect(rail).toContain('.chq-pub-agenda-layout');
    expect(rail).toMatch(/\.chq-pub-agenda-layout\s*\{[^}]*grid-template-columns:\s*1fr 300px;[^}]*gap:\s*60px;/s);
  });

  it(':132 Agenda · 1600 -- the "Highlight a track" select control is built, visually-hidden-labelled', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:156 `Highlight a track`
    expect(frameLine(156)).toContain('Highlight a track');
    const controls = read('agenda-controls.tsx');
    expect(controls).toContain('Highlight a track');
    expect(controls).toContain('chq-pub-track-highlight');
  });

  it(':249 Agenda · a track highlighted -- a "Clear" out-link appears only while a track is active', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:274 `Clear`
    expect(frameLine(274)).toContain('Clear');
    const controls = read('agenda-controls.tsx');
    expect(controls).toMatch(/activeTrackId\s*\?\s*\(\s*<a class="chq-pub-select-clear"[\s\S]*?Clear/);
  });

  it(':249 Agenda · a track highlighted -- the rail swaps its first block to a "N in <Track>" heading', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:337 `2 in AI Engineering`
    expect(frameLine(337)).toContain('2 in AI Engineering');
    const rail = read('agenda-rail.tsx');
    expect(rail).toContain('TrackHighlightRailSection');
    expect(rail).toMatch(/\{matches\.length\}\s*in\s*\{trackName\}/);
  });

  it(':680 Speakers · list view -- the 76px photo / 1fr / 280px sessions row is `.chq-pub-speaker-list-row`', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:711 `grid-template-columns:76px 1fr 280px; gap:20px`
    expect(frameLine(711)).toContain('grid-template-columns:76px 1fr 280px; gap:20px');
    const cards = read('css', 'cards.css.ts');
    expect(cards).toMatch(
      /\.chq-pub-speaker-list-row\s*\{[^}]*grid-template-columns:\s*76px 1fr 280px;[^}]*gap:\s*20px;/s
    );
  });

  it(':680/:730 List/Grid are one Speakers surface (DEC-990): the switching flag is the "speakers"/"gallery" active prop', () => {
    const speakers = read('speakers.tsx');
    // The toggle component itself: a two-state active union, not two pages.
    expect(speakers).toContain('active: "speakers" | "gallery"');
    expect(speakers).toMatch(/aria-current=\{active === "speakers" \? "page" : undefined\}/);
    expect(speakers).toMatch(/aria-current=\{active === "gallery" \? "page" : undefined\}/);
  });

  it(':730 Speakers · grid view -- the six-column gallery grid is `.chq-pub-gallery-grid` (repeat(6, 1fr); gap value diverges, filed in the ledger doc, not asserted here)', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:760 `grid-template-columns:repeat(6, 1fr)`
    expect(frameLine(760)).toContain('grid-template-columns:repeat(6, 1fr)');
    const agenda = read('css', 'agenda.css.ts');
    expect(agenda).toContain('.chq-pub-gallery-grid { grid-template-columns: repeat(6, 1fr);');
  });

  it(':779 My schedule -- the same list+300px-rail 60px-gap pair, as `.chq-pub-schedule-layout`', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:795 `grid-template-columns:minmax(0, 820px) 300px; gap:60px`
    expect(frameLine(795)).toContain('grid-template-columns:minmax(0, 820px) 300px; gap:60px');
    const rail = read('css', 'rail.css.ts');
    expect(rail).toMatch(
      /\.chq-pub-schedule-layout\s*\{[^}]*grid-template-columns:\s*1fr 300px;[^}]*gap:\s*60px;/s
    );
  });

  it(':779 My schedule -- /schedule is dispatched to the wide measure, joining sessions/agenda/speakers/gallery', () => {
    const shell = read('shell.tsx');
    expect(shell).toMatch(/case\s*"schedule":[\s\S]{0,60}return\s*"wide"/);
  });

  it(':894 Submit a talk -- the Track/Format two-column row is `.chq-cfp-track-format-row` (1fr 1fr; gap:18px)', () => {
    // docs/design/Chautauqua Public and Portal.dc.html:931 `grid-template-columns:1fr 1fr; gap:18px`
    expect(frameLine(931)).toContain('grid-template-columns:1fr 1fr; gap:18px');
    const cfpCss = readFileSync(join(SRC_PUBLIC, 'cfp.css.ts'), 'utf-8');
    expect(cfpCss).toContain('.chq-cfp-track-format-row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px;');
  });
});
