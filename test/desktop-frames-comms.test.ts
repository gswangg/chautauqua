// Desktop-frame claims, Comms cluster (DEC-976, v12 mobile campaign wave
// 103; task v12m-w3-r). Node tier only -- readFileSync over sources, no
// jsdom, no render. Claims 8 of the 9 desktop frames
// test/desktop-frame-ledger.scan.test.ts enumerates from
// `docs/design/Chautauqua Comms.dc.html` (EXPECTED_PER_FILE['Chautauqua
// Comms.dc.html'] === 9): :28, :222, :360, :453, :544, :589, :686, :712.
// The ninth, :750 "Compose · send blocked", is out of this task's scope and
// stays unclaimed for a future lane.
//
// Receipt shape (DEC-976 wave-87/102): each it() carries the strict
// citation `docs/design/Chautauqua Comms.dc.html:<line>` and a
// backtick-quoted literal copied VERBATIM from that frame line, with a real
// expect() about the tree within 6 source lines. Expected values are TYPED
// literals, never a re-read of the frame compared to itself. Assertions run
// against file CONTENT (rendered strings / literal source text), never
// against an app file's line number.
//
// :686/:712 are the rendered EMAIL surfaces -- claimed against
// `src/mail/shell.ts` (the single 560px shell every outbound HTML body
// renders through, DEC-037 amendment wave 20), not the SPA. Per DEVIATIONS
// §6, "email HTML shells' CTA/callout/signature anatomy (07--09..12)" is an
// explicitly deferred post-deadline rework -- an anatomy mismatch there is
// a cited deviation, not a new finding, so this file claims only the
// shell's measure/structure, which DOES match, and does not chase anatomy.
//
// DESKTOP IS FROZEN: this file asserts against existing source; it makes no
// CSS/TSX change.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderEmailHtml } from '../src/mail/shell';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Comms.dc.html');
const FRAME_LINES = readFileSync(DESIGN_FILE, 'utf-8').split('\n');

/** 1-based line lookup so a citation's quote can be asserted against the
 * pack itself (not re-derived), catching a re-cut that moves the line. */
function frameLine(n: number): string {
  const line = FRAME_LINES[n - 1];
  if (line === undefined) throw new Error(`docs/design/Chautauqua Comms.dc.html has no line ${n}`);
  return line;
}

const APP_SRC = join(REPO_ROOT, 'app', 'src');

function read(relPath: string): string {
  return readFileSync(join(APP_SRC, relPath), 'utf-8');
}

describe('desktop frame claims: Comms cluster (v12m-w3-r)', () => {
  // docs/design/Chautauqua Comms.dc.html:28
  // `Compose · step 3 of 4 · 1600`
  it('renders step 3 (Recipients / Preview / Send N emails) in ComposeWizard.tsx', () => {
    expect(frameLine(28)).toContain('Compose · step 3 of 4 · 1600');
    const src = read('pages/comms/ComposeWizard.tsx');
    expect(src).toContain('Change selection');
    expect(src).toContain('Back to the template');
    expect(src).toContain("Recipients &middot; {preview.length}");
  });

  // docs/design/Chautauqua Comms.dc.html:222
  // `Templates`
  it('renders the Templates split screen (list + editor) in TemplatesTab.tsx', () => {
    expect(frameLine(222)).toContain('>Templates<');
    const src = read('pages/comms/TemplatesTab.tsx');
    expect(src).toContain('Duplicate');
    expect(src).toContain('Use in a send');
  });

  // docs/design/Chautauqua Comms.dc.html:360
  // `Compose · step 1 of 4`
  it('renders step 1 ("Who is this going to?" seam) in ComposeWizard.tsx', () => {
    expect(frameLine(360)).toContain('Compose · step 1 of 4');
    const src = read('pages/comms/ComposeWizard.tsx');
    expect(src).toContain('Who is this going to?');
    expect(src).toContain('Nothing sends until step 4');
    expect(src).toContain('Next: choose a template');
  });

  // docs/design/Chautauqua Comms.dc.html:453
  // `Compose · step 4 of 4`
  it('renders the step 4 send report in ComposeWizard.tsx', () => {
    expect(frameLine(453)).toContain('Compose · step 4 of 4');
    const src = read('pages/comms/ComposeWizard.tsx');
    expect(src).toContain('speakers were emailed');
    expect(src).toContain('Compose another');
    expect(src).toContain('Back to Comms');
  });

  // docs/design/Chautauqua Comms.dc.html:544
  // `Comms · nothing sent yet`
  it('renders the fresh empty state in RecentSends.tsx', () => {
    expect(frameLine(544)).toContain('Comms · nothing sent yet');
    const src = read('pages/comms/RecentSends.tsx');
    expect(src).toContain('You have not emailed anyone yet');
    expect(src).toContain('Read the templates ›');
  });

  // docs/design/Chautauqua Comms.dc.html:589
  // `Comms · history`
  it('renders the History tab (chips, Export CSV, pager) in HistoryTab.tsx', () => {
    expect(frameLine(589)).toContain('Comms · history');
    const src = read('pages/comms/HistoryTab.tsx');
    expect(src).toContain('All sends');
    expect(src).toContain('Export CSV');
  });

  // docs/design/Chautauqua Comms.dc.html:686
  // `What each template renders`
  it('renders each outbound email through the ONE 560px shell in src/mail/shell.ts', () => {
    expect(frameLine(686)).toContain('What each template renders');
    // src/mail/shell.ts is a `src/**` file, out of this task's app/src root
    // but the correct home for the rendered EMAIL surface per this task's
    // instructions.
    const html = renderEmailHtml('Hi there.', {
      eventName: 'DevFlow Conf 2027',
      reason: "you're a speaker at this event",
    });
    expect(html).toContain('width:560px;max-width:560px');
  });

  // docs/design/Chautauqua Comms.dc.html:712
  // `DevFlow Conf 2027`
  it('renders the email masthead wordmark and footer event line via renderEmailHtml', () => {
    expect(frameLine(712)).toContain('DevFlow Conf 2027');
    const html = renderEmailHtml('Hi there.', {
      eventName: 'DevFlow Conf 2027',
      reason: "you're a speaker at this event",
    });
    expect(html).toContain('DevFlow Conf 2027');
    expect(html).toContain('sent with');
  });
});
