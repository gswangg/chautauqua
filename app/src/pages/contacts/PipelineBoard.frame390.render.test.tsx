// w31-c (DEC-976/DEC-576/DEC-385 wave-31): the frame's first markup-level
// verdict for "Pipeline · 390" (docs/design/Chautauqua Contacts.dc.html:447
// -477). Until this file, the frame was cited only by
// contacts-drill-phone-heads.test.ts's CSS-text-only pins and
// PipelineBoard.render.test.tsx's task-w19-a dock smoke tests (structure
// only, no ordered walk of the frame's own drawn literals). This file
// mounts the REAL board -- the exact mount PipelineBoard.render.test.tsx
// already uses, never a second mock stack (DEC-663) -- and asserts DOM
// structure/order (jsdom applies no @media, so every claim here is about
// markup, never computed geometry) plus static CSS-text receipts for the
// dock/tabbar/head-suppression contract that jsdom cannot compute.
//
// DEC-967 wave-31: structural copy graded by literal, sample data graded by
// SHAPE -- the per-card name/company/score/note/age fields below are never
// pinned to the frame's own sample strings/counts ("Priya Raman", "Fit 5").
//
// THE RECONCILIATION (DEC-576 wave-31): docs/design/DEVIATIONS.md carries
// two contradicting entries for this frame -- §3 rules "Contacts Pipeline
// keeps its landed head action; no phone dock is minted (DEC-576
// wave-120/124)"; §6 REVERSES that ("Contacts Pipeline · 390 dock IS
// minted"), and docs/mobile-campaign.md's round-3 correction re-verified
// the dock live at 390. The LATER entry wins (DEC-099: an amendment that
// reverses says so): this file grades the tree against §6 + the round-3
// correction, and the audit file this task also creates
// (docs/design/audit/contacts-pipeline-390-v12.md) opens with a row
// stating plainly that §3's no-dock entry is STALE -- for a later
// merge-train lane to fold into DEVIATIONS.md, which this task must not
// edit itself.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { PipelineBoard } from './PipelineBoard';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** DEC-976: a citation that can never silently rot to a wrong line -- read
 * the ACTUAL design-file line and assert it byte-for-byte matches the
 * literal this file claims. Mirrors MergePage.frame390.render.test.tsx's
 * own `verbatimLine` (v12m-w29-a). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// jsdom implements no matchMedia at all by default -- the whole board
// renders the desktop tree unless a test stubs it, same idiom
// PipelineBoard.render.test.tsx's own task-w19-a suite (:1314-1324) uses.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/contacts?tab=pipeline']}>
      <PipelineBoard />
    </MemoryRouter>,
  );
}

// Both fixtures sit in 'identified' -- the phone list's default filter --
// so the ordered card-shape walk below has a card to inspect without
// touching the "Filter" sheet (that flow is already covered by
// PipelineBoard.render.test.tsx's task-w19-a suite).
const ENTRY_A = {
  id: 'entry-a',
  contactId: 'ct-a',
  firstName: 'Priya',
  lastName: 'Raman',
  company: 'Northwind Events',
  email: 'priya@example.com',
  stage: 'identified' as const,
  updatedAt: Date.now() - 3 * 86_400_000,
  stageSince: Date.now() - 3 * 86_400_000,
  declineReason: null,
  fitScore: 4,
  rationale: 'Keynoted a similar event last year',
};

const ENTRY_B = {
  id: 'entry-b',
  contactId: 'ct-b',
  firstName: 'Marcus',
  lastName: 'Okafor',
  company: null,
  email: 'marcus@example.com',
  stage: 'identified' as const,
  updatedAt: Date.now() - 10 * 86_400_000,
  stageSince: Date.now() - 10 * 86_400_000,
  declineReason: null,
  fitScore: null,
  rationale: null,
};

describe('v12 frame render verdict "Pipeline · 390" (docs/design/Chautauqua Contacts.dc.html:447-477, task w31-c, DEC-976 wave-31)', () => {
  it('renders every drawn body element from the real /contacts pipeline tab, in order', async () => {
    // docs/design/Chautauqua Contacts.dc.html:449 `<a href="#" ...>‹ Contacts</a>`
    verbatimLine(
      449,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Contacts</a>',
    );
    // docs/design/Chautauqua Contacts.dc.html:450 `<h1 ...>Pipeline</h1>`
    verbatimLine(
      450,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Pipeline</h1>',
    );
    // docs/design/Chautauqua Contacts.dc.html:451 `<span ...>20 people</span>`
    verbatimLine(451, '        <span style="font-size:13px; color:#565A4B">20 people</span>');
    // docs/design/Chautauqua Contacts.dc.html:453-457 -- the five-stage chip
    // strip, "Identified · 7" through "Declined · 2" (sample counts, graded
    // by shape below, never pinned).
    verbatimLine(
      453,
      '        <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Identified · 7</span>',
    );
    verbatimLine(
      454,
      '        <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:500">Contacted · 5</span>',
    );
    verbatimLine(
      455,
      '        <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:500">Interested · 4</span>',
    );
    verbatimLine(
      456,
      '        <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:500">Confirmed · 2</span>',
    );
    verbatimLine(
      457,
      '        <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:500">Declined · 2</span>',
    );
    // docs/design/Chautauqua Contacts.dc.html:470 `...>Move ›</span>`
    verbatimLine(
      470,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:600">Move ›</span>',
    );
    // docs/design/Chautauqua Contacts.dc.html:473-475 -- the dock band.
    verbatimLine(
      473,
      '      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">',
    );
    verbatimLine(
      474,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Add someone</span>',
    );
    verbatimLine(
      475,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Filter</span>',
    );

    stubPhoneMatchMedia();
    mockApi({
      'GET /api/v1/pipeline': listEnvelope([ENTRY_A, ENTRY_B]),
    });

    renderBoard();
    await waitFor(() => {
      const list = document.querySelector('.chq-contacts-pipeline-phone-list');
      expect(list).not.toBeNull();
      expect(within(list as HTMLElement).getByText('Priya Raman')).toBeInTheDocument();
    });

    // :449 -- exactly one back control naming the drill target. The frame
    // draws an <a>; the landed page composes the shell's own back-link
    // vocabulary as a <button> (client-side tab switch, DEC-710) -- an
    // already-landed, already-audited divergence this task does not
    // reopen, so this asserts the control's accessible name, not its tag.
    expect(screen.getAllByRole('button', { name: '‹ Contacts' })).toHaveLength(1);

    // :450 -- exactly one <h1> reading the frame's literal title.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Pipeline' })).toBeInTheDocument();

    // :451 -- the count caption, shape-matched (never the frame's own "20
    // people" sample), and never the desktop-only "· drag between columns"
    // clause at phone width.
    const caption = document.querySelector('.chq-contacts-pipeline-caption');
    expect(caption).not.toBeNull();
    expect(caption!.textContent).toMatch(/^\d+ people$/);

    // :452-457 -- the five-stage chip strip, in the frame's own order, each
    // reading "<label> · <count>" (SHAPE, never the frame's sample counts).
    const strip = document.querySelector('.chq-contacts-pipeline-phone-stages') as HTMLElement;
    expect(strip).not.toBeNull();
    const chips = within(strip).getAllByRole('button');
    expect(chips).toHaveLength(5);
    chips.forEach((chip, i) => {
      const stage = PIPELINE_STAGES[i]!;
      expect(chip.textContent).toMatch(new RegExp(`^${PIPELINE_STAGE_LABELS[stage]} · \\d+$`));
    });

    // :458-472 -- each phone card: name / company / (fit chip · note) / age,
    // in that structural order, SHAPE-matched, never the frame's sample
    // data ("Priya Raman" here is this test's OWN fixture, not the frame's
    // literal -- the frame's own sample name is never asserted).
    const list = document.querySelector('.chq-contacts-pipeline-phone-list') as HTMLElement;
    const cards = within(list).getAllByRole('listitem') as HTMLLIElement[];
    expect(cards.length).toBeGreaterThan(0);
    const cardA = cards.find((c) => c.textContent?.includes('Priya Raman'))!;
    expect(cardA).toBeDefined();
    const body = cardA.querySelector('.chq-contacts-pipeline-phone-card-body') as HTMLElement;
    const fields = Array.from(body.children).map((el) => el.className);
    // name, company, fit-row, age, in that order (declineReason/move-error
    // are absent for this fixture, so no extra siblings intervene).
    expect(fields[0]).toContain('chq-contacts-pipeline-card-name');
    expect(fields[1]).toContain('chq-contacts-pipeline-card-company');
    expect(fields[2]).toContain('chq-contacts-pipeline-card-fit-row');
    expect(fields[fields.length - 1]).toContain('chq-contacts-pipeline-card-age');
    expect(within(body).getByText('Fit 4')).toBeInTheDocument();
    expect(within(body).getByText('Keynoted a similar event last year')).toBeInTheDocument();
    expect((body.querySelector('.chq-contacts-pipeline-card-age') as HTMLElement).textContent).toMatch(
      /^Added .+ ago$/,
    );

    // :470 -- the "Move ›" control, one per visible card, right-flushed
    // (flex-shrink:0) sibling of the card body, never a second stage
    // control on the card face (w4-c/DEC-898).
    const moveButtons = within(list).getAllByRole('button', { name: /^Move / });
    expect(moveButtons).toHaveLength(cards.length);
    expect(moveButtons[0]!.textContent).toBe('Move ›');

    // :473-475 -- the dock band, EXACTLY once, with the frame's two
    // controls in DOM order.
    const docks = document.querySelectorAll('[data-chq-phone-dock]');
    expect(docks).toHaveLength(1);
    const dock = docks[0] as HTMLElement;
    expect(dock).toHaveClass('chq-phone-dock');
    const dockButtons = within(dock).getAllByRole('button');
    expect(dockButtons).toHaveLength(2);
    expect(dockButtons[0]!.textContent).toBe('Add someone');
    expect(dockButtons[1]!.textContent).toBe('Filter');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('44x44 floor: "Move ›" floors at >=44px with zero margin, inheriting the shared .chq-btn phone floor', () => {
    const cssPath = join(HERE, 'contacts-panels.css');
    const css = stripCssComments(readFileSync(cssPath, 'utf-8'));

    // contacts-panels.css has a single @media (max-width: 700px) block
    // (confirmed by source: only one `^@media` line in the file) -- extract
    // it by brace-depth, same walk MergePage.frame390.render.test.tsx uses.
    const mediaOpener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
    const openMatch = mediaOpener.exec(css);
    expect(openMatch).not.toBeNull();
    let depth = 1;
    let i = openMatch!.index + openMatch![0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    expect(depth).toBe(0);
    const phoneLayer = css.slice(start, i - 1);

    function ruleBodies(selector: string): string[] {
      const rule = /([^{}]+)\{([^{}]*)\}/g;
      const bodies: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = rule.exec(phoneLayer)) !== null) {
        const selectors = m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
        if (selectors.includes(selector)) bodies.push(m[2]!);
      }
      return bodies;
    }

    // styles.css's own terminal phone block floors every .chq-btn at 44px
    // (app/src/styles.css:2447) -- "Move ›" (.chq-btn.chq-btn-secondary)
    // inherits this floor rather than redeclaring it.
    const stylesCss = stripCssComments(readFileSync(join(HERE, '..', '..', 'styles.css'), 'utf-8'));
    const styleMediaOpener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
    const styleOpen = styleMediaOpener.exec(stylesCss);
    expect(styleOpen).not.toBeNull();
    let sDepth = 1;
    let si = styleOpen!.index + styleOpen![0].length;
    const sStart = si;
    while (si < stylesCss.length && sDepth > 0) {
      if (stylesCss[si] === '{') sDepth += 1;
      else if (stylesCss[si] === '}') sDepth -= 1;
      si += 1;
    }
    const stylesPhoneLayer = stylesCss.slice(sStart, si - 1);
    const btnRule = /(^|\n)\s*\.chq-btn\s*\{([^{}]*)\}/.exec(stylesPhoneLayer);
    expect(btnRule).not.toBeNull();
    const btnFloorMatch = btnRule![2]!.match(/min-height:\s*(\d+)px/);
    expect(btnFloorMatch).not.toBeNull();
    expect(Number(btnFloorMatch![1])).toBeGreaterThanOrEqual(44);

    // "Move ›"'s own rule (contacts-panels.css) never redeclares a
    // min-height below the shared floor, and never sets a margin (the
    // frame draws it flush against the card row, "zero margin").
    const moveBodies = ruleBodies('.chq-contacts-pipeline-phone-card-move');
    expect(moveBodies.length).toBeGreaterThan(0);
    for (const body of moveBodies) {
      const minHeight = body.match(/min-height:\s*(\d+)px/);
      if (minHeight) expect(Number(minHeight[1])).toBeGreaterThanOrEqual(44);
      expect(body).not.toMatch(/margin(?!-inline|-block)\s*:/);
    }
  });

  it('reconciliation (DEC-576 wave-31): the dock IS minted -- sticky band, 48px controls, tab bar suppressed, head action superseded', () => {
    const panelsCss = stripCssComments(
      readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8'),
    );
    const shellCss = stripCssComments(readFileSync(join(HERE, '..', '..', 'styles.css'), 'utf-8'));

    // Property 1 (position:sticky; bottom:0): the shared .chq-phone-dock
    // band this board composes onto (styles.css's phone block).
    expect(shellCss).toMatch(/\.chq-phone-dock\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;/s);

    // Property 2 (both dock buttons floor at 48px): styles.css's
    // `.chq-phone-dock .chq-btn` rule.
    expect(shellCss).toMatch(/\.chq-phone-dock \.chq-btn\s*\{[^}]*min-height:\s*48px;/s);

    // Property 3 (.chq-tabbar computes display:none once a page mints a
    // dock): the sibling-combinator suppression contract keyed off the same
    // data-chq-phone-dock attribute this board's dock carries.
    expect(shellCss).toMatch(
      /\.chq-main:has\(\[data-chq-phone-dock\]\)\s*~\s*\.chq-tabbar\s*\{[^}]*display:\s*none;/s,
    );

    // Property 4 (the head's own "Add to the pipeline" is hidden at 390,
    // unchanged at 1440): `.chq-contacts-pipeline-head > .chq-btn` is
    // declared exactly twice, BOTH inside contacts-panels.css's single
    // terminal @media (max-width: 700px) block -- no top-level (desktop)
    // declaration exists for this selector at all, so above 700px it keeps
    // the base `.chq-btn` display (inline-flex, unchanged). The LATER of
    // the two phone declarations (display:none) wins the cascade over the
    // earlier full-width/48px one, per DEC-385/DEC-099 ("an amendment that
    // reverses says so" -- this file's own comment states which wins).
    const headBtnDecls = [...panelsCss.matchAll(/\.chq-contacts-pipeline-head > \.chq-btn\s*\{([^}]*)\}/g)];
    expect(headBtnDecls).toHaveLength(2);
    expect(headBtnDecls[0]![1]).not.toMatch(/display:\s*none/);
    expect(headBtnDecls[1]![1]).toMatch(/display:\s*none/);
    // No top-level (non-media) declaration of the selector exists, so the
    // "unchanged at 1440" half of the claim holds by absence.
    const mediaOpener = /@media\s*\(max-width:\s*700px\)\s*\{/;
    const openIdx = panelsCss.search(mediaOpener);
    expect(openIdx).toBeGreaterThan(-1);
    const beforeMedia = panelsCss.slice(0, openIdx);
    expect(beforeMedia).not.toMatch(/\.chq-contacts-pipeline-head > \.chq-btn/);

    // Live receipt: the dock renders exactly once from the real component,
    // and the head's "Add to the pipeline" is still present in markup
    // (jsdom applies no @media -- the hide is CSS-only, verified above) but
    // never duplicated by the dock's own "Add someone" naming collision.
    stubPhoneMatchMedia();
    mockApi({ 'GET /api/v1/pipeline': listEnvelope([ENTRY_A]) });
    renderBoard();
    return waitFor(() => {
      expect(document.querySelectorAll('[data-chq-phone-dock]')).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Add to the pipeline' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Add someone' })).toHaveLength(1);
    });
  });
});
