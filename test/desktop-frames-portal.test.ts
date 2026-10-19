// Desktop-frame claims, Public/Portal cluster remainder (DEC-976, v12
// mobile campaign wave 105; task v12m-w5-c). Node tier only -- readFileSync
// over sources, no jsdom, no render. Claims 5 of this task's 6 assigned
// frames from `docs/design/Chautauqua Public and Portal.dc.html`: :1101,
// :1211, :1373, :1473, :1532. test/desktop-frames-public.test.ts
// (v12m-w3-s) already claims the public half of this design file and is
// NOT touched by this file -- single-owner per file.
//
// These six surfaces are SSR (Hono sub-apps under `src/routes/...`, DEC-012
// -- no SPA state layer, DEC-383), so this file reads from `src/routes/...`
// rather than `app/src`, per this task's own instruction.
//
// Receipt shape (DEC-976 wave-87/102/105): each it() carries the strict
// citation `docs/design/Chautauqua Public and Portal.dc.html:<line>` and a
// backtick-quoted literal copied VERBATIM from that frame line, with a real
// expect() about the tree within 6 source lines. Expected values are TYPED
// literals, never a re-read of the frame compared to itself. Assertions run
// against file CONTENT (rendered strings / literal source text), never
// against an app file's line number.
//
// DESKTOP IS FROZEN: this file asserts against existing source; it makes no
// CSS/TSX change.
//
// UNCLAIMED, divergence filed (DEC-967 -- a frame the tree contradicts
// stays unclaimed rather than force-fit):
//
// :1167 "Public sessions · nothing published" -- the frame draws a 300px
// `<aside>` sidebar headed "Last year" that links out to the prior event's
// session list (`Chautauqua Public and Portal.dc.html:1187-1198`, a
// `DevFlow Conf 2026 · 48 sessions · Sessions ›` card). No such feature
// exists anywhere in the tree: `grep -rn "Last year" src/` and
// `grep -rn "previousEvent\|priorEvent" src/` both return nothing, and
// `src/routes/public/sessions.tsx`'s zero-items branch renders only
// `PublicEmptyState` (no aside, no prior-event lookup at all). This is not
// listed in `docs/design/DEVIATIONS.md` §6 (checked: neither "sessions
// last year" nor a prior-event sidebar appears there), so it is a genuine
// unfiled gap rather than an already-adjudicated one -- filed here per this
// task's header instruction rather than claimed. (The empty-state
// headline "The programme is not out yet" DOES match
// `sessions.tsx:371` verbatim; only the sidebar and the reason sentence
// diverge, but a whole missing grid column is more than a copy tweak, so
// the frame stays unclaimed rather than partially claimed.)
//
// :1373 "Portal · Edit your session · desktop" note-line "560 column · the
// one portal view with a form" is a KNOWN, already-adjudicated deviation
// (DEVIATIONS.md §6, "Adjudications recorded": "Portal measure WIDENED
// against the frames: --chq-portal-measure 560px (drawn) -> var(--chq-
// measure) (the 820px admin/overview measure)"), confirmed live at
// `src/routes/portal/portal.css.ts:328` (`max-width: var(--chq-portal-
// measure)`). This file claims :1373's copy/structure (title, abstract,
// co-presenter section, footer actions) but does NOT assert the 560px
// measure, since the frame's own annotation is superseded by that ruling.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Public and Portal.dc.html');
const FRAME_LINES = readFileSync(DESIGN_FILE, 'utf-8').split('\n');

/** 1-based line lookup so a citation's quote can be asserted against the
 * pack itself (not re-derived), catching a re-cut that moves the line. */
function frameLine(n: number): string {
  const line = FRAME_LINES[n - 1];
  if (line === undefined) throw new Error(`docs/design/Chautauqua Public and Portal.dc.html has no line ${n}`);
  return line;
}

const SRC_ROUTES = join(REPO_ROOT, 'src', 'routes');

function read(relPath: string): string {
  return readFileSync(join(SRC_ROUTES, relPath), 'utf-8');
}

describe('desktop frame claims: Public/Portal remainder (v12m-w5-c)', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:1101
  // `CFP closed`
  it('renders the CFP-closed dead-end via ClosedPage in submit-views.tsx', () => {
    expect(frameLine(1101)).toContain('CFP closed');
    const src = read('public/submit-views.tsx');
    expect(src).toContain('export function ClosedPage');
    expect(src).toContain('The call for papers has closed');
    expect(src).toContain('Submissions closed on');
    expect(src).toContain('Browse the sessions &rsaquo;');
  });

  // docs/design/Chautauqua Public and Portal.dc.html:1211
  // `Submit a talk · rejected on submit`
  it('renders the top-of-form error summary and Submit/Save-draft pair in submit-views.tsx', () => {
    expect(frameLine(1211)).toContain('Submit a talk · rejected on submit');
    const src = read('public/submit-views.tsx');
    // the frame's own annotation, "Errors set in type and rule weight,
    // never colour alone" -- matched structurally by ErrorSummary's
    // chq-error-summary block (see error-states.css.ts for the
    // colour-independent treatment; this file asserts the copy/DOM shape).
    expect(src).toContain('export function ErrorSummary');
    expect(src).toContain('thingsNeedFixingHeading(n, "before this can be sent")');
    expect(src).toContain('Nothing was lost. Everything you typed is still below.');
    expect(src).toContain('Submit this talk');
    expect(src).toContain('Save draft');
    // "Three things need fixing before this can be sent" (frame :1215) is
    // produced by thingsNeedFixingHeading(3, ...) -- assert the composer
    // directly against a typed literal rather than re-deriving the frame.
    const countCopy = readFileSync(join(REPO_ROOT, 'src', 'domain', 'count-copy.ts'), 'utf-8');
    expect(countCopy).toContain('function thingsNeedFixingHeading');
  });

  // docs/design/Chautauqua Public and Portal.dc.html:1373
  // `Portal · Edit your session · desktop`
  it('renders the Edit-your-session form (title/abstract/co-presenter/footer) in portal/edit.tsx', () => {
    expect(frameLine(1373)).toContain('Portal · Edit your session · desktop');
    const src = read('portal/edit.tsx');
    expect(src).toContain('Edit your session');
    expect(src).toContain('Add a co-presenter');
    expect(src).toContain(
      'Adding them puts a row in the list above straight away. No email goes to them — tell them yourself, and',
    );
    expect(src).toContain('On this session');
    expect(src).toContain('Save changes');
  });

  // docs/design/Chautauqua Public and Portal.dc.html:1473
  // `Portal preview · /portal/preview`
  it('SUPERSEDED (multi-portal decision 74): the general organizer preview is gone; preview as a person shows what someone gets', () => {
    expect(frameLine(1473)).toContain('Portal preview · /portal/preview');
    expect(read('portal/preview-person.tsx')).toContain('Exit preview');
  });

  // docs/design/Chautauqua Public and Portal.dc.html:1532
  // `CFP not open yet · /submit/:slug`
  it('renders the third window state (date-led heading, no apology) via NotYetOpenPage in submit-views.tsx', () => {
    expect(frameLine(1532)).toContain('CFP not open yet · /submit/:slug');
    const src = read('public/submit-views.tsx');
    expect(src).toContain('export function NotYetOpenPage');
    // DESIGN-RULINGS "CFP -- the third window state": heading LEADS with
    // the open date, never an apology.
    expect(src).toContain('The call for papers opens on');
    expect(src).toContain('Browse the sessions &rsaquo;');
  });
});
