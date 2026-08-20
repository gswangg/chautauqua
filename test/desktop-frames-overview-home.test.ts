// Desktop-frame claims, Overview cluster (4) + Home cluster (2) (DEC-976,
// v12 mobile campaign wave 105; task v12m-w5-d). Node tier only --
// readFileSync over sources, no jsdom, no render.
//
// Overview frames (docs/design/Chautauqua Overview.dc.html):
//   :308 "New event"                     -> app/src/components/EventSwitcher.tsx
//   :432 "Overview · a brand-new event"  -> app/src/pages/Overview.tsx
//   :476 "States · hover, pending, drag" -> app/src/styles.css + app/src/components/PendingAction.tsx
//   :689 "Loading · the first paint"     -> app/src/components/PageSkeleton.tsx + DelayedLoading.tsx
// EXCLUDED per this task's own instructions (not frames, explainer panels /
// template interpolation): :353 "Widths · what a wide monitor gets".
//
// Home frames (docs/design/Chautauqua Home.dc.html, SSR not the SPA):
//   :181 "Between cycles · desktop" -> src/routes/root.tsx + src/routes/public/home.css.ts
//   :269 "Fresh deploy · desktop"   -> src/routes/root.tsx + src/routes/public/home.css.ts
// EXCLUDED: :326 "Rules you can't see on the page" (explainer panel).
//
// DIVERGENCE FILED, not chased (frame vs tree, tree wins nothing here --
// this is a citation-path correction, not a design contradiction): the
// task brief names "app/src/pages/public/index.tsx" as the Home frames'
// home, but the org root-hub page ("/") that actually renders "No open
// calls right now" / "Nothing here yet" / "Running on ... Chautauqua" is
// src/routes/root.tsx (HubPage), styled by src/routes/public/home.css.ts.
// src/routes/public/index.tsx owns the per-EVENT surfaces (/e/:slug), a
// different route family entirely (DEC-582/DEC-581). This file claims
// against the file that actually renders the frame's content.
//
// Receipt shape (DEC-976 wave-87/102/105): each it() carries the strict
// citation `docs/design/<File>.dc.html:<line>` and a backtick-quoted
// literal copied VERBATIM from that frame line, with a real expect() about
// the tree within 6 source lines. Expected values are TYPED literals,
// never a re-read of the frame compared to itself. Assertions run against
// file CONTENT (rendered strings / literal source text), never against an
// app file's line number.
//
// DESKTOP IS FROZEN: this file asserts against existing source; it makes
// no CSS/TSX change. Does not touch CLAIMED_FLOOR (DEC-385 wave-105).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');

const OVERVIEW_DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Overview.dc.html');
const OVERVIEW_FRAME_LINES = readFileSync(OVERVIEW_DESIGN_FILE, 'utf-8').split('\n');

const HOME_DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Home.dc.html');
const HOME_FRAME_LINES = readFileSync(HOME_DESIGN_FILE, 'utf-8').split('\n');

/** 1-based line lookup so a citation's quote can be asserted against the
 * pack itself (not re-derived), catching a re-cut that moves the line. */
function overviewFrameLine(n: number): string {
  const line = OVERVIEW_FRAME_LINES[n - 1];
  if (line === undefined) throw new Error(`docs/design/Chautauqua Overview.dc.html has no line ${n}`);
  return line;
}

/** Same as overviewFrameLine, for the Home pack. */
function homeFrameLine(n: number): string {
  const line = HOME_FRAME_LINES[n - 1];
  if (line === undefined) throw new Error(`docs/design/Chautauqua Home.dc.html has no line ${n}`);
  return line;
}

const APP_SRC = join(REPO_ROOT, 'app', 'src');
const SRC = join(REPO_ROOT, 'src');

function readAppSrc(relPath: string): string {
  return readFileSync(join(APP_SRC, relPath), 'utf-8');
}

function readSrc(relPath: string): string {
  return readFileSync(join(SRC, relPath), 'utf-8');
}

describe('desktop frame claims: Overview cluster (v12m-w5-d)', () => {
  // docs/design/Chautauqua Overview.dc.html:308
  // `New event`
  it('renders the "New event" modal (Name field, settings-afterwards subtitle, Close) in EventSwitcher.tsx', () => {
    expect(overviewFrameLine(308)).toContain('New event');
    const src = readAppSrc('components/EventSwitcher.tsx');
    expect(src).toContain('title="New event"');
    expect(src).toContain('subtitle="You land in its settings afterwards"');
    expect(src).toContain('Create the event');
    expect(src).toContain('label="Name"');
  });

  // docs/design/Chautauqua Overview.dc.html:432
  // `Overview · a brand-new event`
  it('renders the nothing-has-happened-yet empty state in Overview.tsx', () => {
    expect(overviewFrameLine(432)).toContain('Overview · a brand-new event');
    const src = readAppSrc('pages/Overview.tsx');
    expect(src).toContain('nothing scheduled');
    expect(src).toContain('Nothing needs you yet');
    expect(src).toContain('Set up the call for papers');
    expect(src).toContain('Add a speaker by hand');
  });

  // docs/design/Chautauqua Overview.dc.html:476
  // `States · hover, pending, drag`
  it('renders the B8 state vocabulary (hover/pressed/disabled tiers, pending-count label) via styles.css + PendingAction.tsx', () => {
    expect(overviewFrameLine(476)).toContain('States · hover, pending, drag');
    const css = readAppSrc('styles.css');
    // Disabled tier: rest colour + own background, never a hover repaint.
    expect(css).toContain('.chq-btn:disabled,');
    expect(css).toContain('a disabled button has no hover state at all');
    // Pending: the button carries cursor:progress and nothing else colour-wise.
    expect(css).toContain('.chq-btn-pending {');
    expect(css).toContain('cursor: progress;');
    const pending = readAppSrc('components/PendingAction.tsx');
    // Frame's "Sending 12 of 23…" countable-progress label shape.
    expect(pending).toContain('`${participle} ${done} of ${total}…`');
    expect(pending).toContain('disabled: pending,');
  });

  // docs/design/Chautauqua Overview.dc.html:689
  // `Loading · the first paint`
  it('draws chrome on the first frame (no timer) and withholds the loading label for 250ms via PageSkeleton.tsx + DelayedLoading.tsx', () => {
    expect(overviewFrameLine(689)).toContain('Loading · the first paint');
    const skeleton = readAppSrc('components/PageSkeleton.tsx');
    // PageSkeleton renders on the first frame -- no timer -- drawing chrome
    // shaped like the arriving page.
    expect(skeleton).toContain('renders on the FIRST frame -- no\n// timer');
    const delayed = readAppSrc('components/DelayedLoading.tsx');
    // DelayedLoading withholds its text label for delayMs (default 250ms) --
    // the "Nothing at all under 250ms" half of the split.
    expect(delayed).toContain('delayMs = 250');
    expect(delayed).toContain('if (!show) return null;');
  });
});

describe('desktop frame claims: Home cluster (v12m-w5-d, SSR)', () => {
  // docs/design/Chautauqua Home.dc.html:181
  // `Between cycles · desktop`
  it('renders the "No open calls right now" between-cycles state (archive section, Sign in) in root.tsx', () => {
    expect(homeFrameLine(181)).toContain('Between cycles · desktop');
    const src = readSrc('routes/root.tsx');
    expect(src).toContain('<h1>No open calls right now</h1>');
    expect(src).toContain('Nothing is taking submissions. Past programmes are still up.');
    expect(src).toContain('Already happened');
    expect(src).toContain('Organisers and reviewers');
    const css = readSrc('routes/public/home.css.ts');
    expect(css).toContain('.chq-home-footer');
  });

  // docs/design/Chautauqua Home.dc.html:269
  // `Fresh deploy · desktop`
  it('renders the "Nothing here yet" fresh-deploy state (Sign in + API docs, Running on footer) in root.tsx', () => {
    expect(homeFrameLine(269)).toContain('Fresh deploy · desktop');
    const src = readSrc('routes/root.tsx');
    expect(src).toContain('<h1>Nothing here yet</h1>');
    expect(src).toContain('No call for papers is open and no programme has been published.');
    expect(src).toContain('API docs ›');
    expect(src).toContain('Running on');
    expect(src).toContain('href="https://github.com/gswangg/chautauqua"');
  });
});
