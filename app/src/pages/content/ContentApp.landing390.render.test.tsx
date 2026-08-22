// w32-e (DEC-825 wave-32): strictly-anchored real-mount verdict for the
// LAST unclaimed Content 390 frame -- the worklist "landing" screen at
// docs/design/'Chautauqua Content.dc.html':198-237. `:247` and `:373` are
// claimed by v12m-w29-h, `:338` by v12m-w29-b; this frame's own extent had
// only 5/8 drawn literals asserted by a file that cites strictly INSIDE it
// (ContentApp.worklist-390.render.test.tsx and ContentApp.render.test.tsx
// assert the same product bytes but never verbatimLine() a line inside
// 198-237, so under DEC-976's strict-anchoring rule neither counts as a
// verified citation of THIS frame). This file mounts the real ContentApp
// (never a sub-component) and enumerates every non-template literal the
// frame draws, each behind its own verbatimLine() re-read at assert time.
//
// Measurement only -- this file makes NO product edits. Findings land in
// docs/design/audit/content-landing-390-v12.md, not in content-v12.md
// (owned by two unmerged branches, v12m-w25-h / v12m-w27-c).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContentApp } from './ContentApp';
import { TAB_LABELS } from './SessionList';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-content-landing-390';
const DESIGN_FILE = join(process.cwd(), 'docs', 'design', 'Chautauqua Content.dc.html');
const CSS_FILE = join(process.cwd(), 'app/src/pages/content/content.css');
const STYLES_FILE = join(process.cwd(), 'app/src/styles.css');

/** DEC-967 shape (copied from ContentApp.worklist-390.render.test.tsx's own
 * verbatimLine): read the ACTUAL line at assert time, fail loudly if the
 * design file has drifted out from under the citation. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** content.css's terminal `@media (max-width: 700px)` block -- brace-matched,
 * LAST occurrence, reused unmodified from ContentApp.worklist-390.render.
 * test.tsx's own contentPhoneBlock helper (DEC-874: jsdom applies no
 * @media, so desktop table markup and this block's phone rules both exist
 * at once -- every query below is scoped to a container, never bare
 * screen.getByText for anything that could double-render). */
function contentPhoneBlock(): string {
  const source = readFileSync(CSS_FILE, 'utf-8');
  const open = source.lastIndexOf('@media (max-width: 700px) {');
  expect(open).toBeGreaterThan(-1);
  const bodyStart = source.indexOf('{', open) + 1;
  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  return source.slice(bodyStart, i - 1);
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `no rule for \`${selector}\``).not.toBeNull();
  return match![1]!;
}

/** styles.css's own single terminal `@media (max-width: 700px)` block --
 * same brace-matched shape as contentPhoneBlock() above, applied to the
 * shared shell sheet the chip strip's `.chq-pill` floor lives in. */
function stylesPhoneBlock(): string {
  const source = readFileSync(STYLES_FILE, 'utf-8');
  const open = source.lastIndexOf('@media (max-width: 700px) {');
  expect(open).toBeGreaterThan(-1);
  const bodyStart = source.indexOf('{', open) + 1;
  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  return source.slice(bodyStart, i - 1);
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderContentApp() {
  return render(
    <MemoryRouter initialEntries={['/content']}>
      <Routes>
        <Route path="/content/:submissionId" element={<ContentApp />} />
        <Route path="/content" element={<ContentApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Three rows -- DEC-180: two samples undercounts. All three sit in the
// default 'needs_decision' tab (contentStatus pending/changes_requested)
// so every row draws Approve unconditionally, matching frame :222's
// unconditional Approve pill for the visible landing state.
function threeRowEnvelope() {
  return listEnvelope(
    [
      {
        id: 'sub-1',
        ref: 'S-001',
        title: 'Scaling Postgres Past a Billion Rows',
        status: 'accepted',
        contentStatus: 'pending',
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000000000,
        reuploaded: false,
        latestFile: { filename: 'slides.pdf', kind: 'slides', versionCount: 1, uploadedAt: 1700000000000 },
        latestFileByKind: { slides: 1 },
        scheduled: null,
      },
      {
        id: 'sub-2',
        ref: 'S-002',
        title: 'Type-Safe Feature Flags',
        status: 'accepted',
        contentStatus: 'changes_requested',
        speakers: [
          { contactId: 'c2', name: 'Grace Hopper' },
          { contactId: 'c3', name: 'Barbara Liskov' },
        ],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000001000,
        reuploaded: true,
        latestFile: { filename: 'deck.pdf', kind: 'slides', versionCount: 2, uploadedAt: 1700000005000 },
        latestFileByKind: { slides: 2 },
        scheduled: null,
      },
      {
        id: 'sub-3',
        ref: 'S-003',
        title: 'Consensus Without Coordination',
        status: 'accepted',
        contentStatus: 'pending',
        speakers: [],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000002000,
        reuploaded: false,
        latestFile: null,
        latestFileByKind: {},
        scheduled: null,
      },
    ],
    {
      contentStatusCounts: { pending: 2, approved: 9, changes_requested: 1 },
      reuploadedCount: 2,
    },
  );
}

describe('ContentApp 390 landing (docs/design/"Chautauqua Content.dc.html":198-237, w32-e)', () => {
  it('draws the head band H1 and summary line verbatim (frame :204/:206)', async () => {
    verbatimLine(
      204,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Content</h1>',
    );
    verbatimLine(
      206,
      '          <span style="font-size:13px; color:#565A4B; line-height:1.5">5 need a decision · 2 re-uploaded</span>',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: threeRowEnvelope(),
    });

    renderContentApp();

    // PRODUCT bytes: real ContentApp mount, real /content route.
    const heading = await screen.findByRole('heading', { name: 'Content' });
    expect(heading).toHaveClass('chq-page-title');

    // Frame's counts (5, 2) are sample data (DEC-967); this fixture's own
    // counts (pending 2 + changes_requested 1 = 3 need a decision, 2
    // re-uploaded) are graded by SHAPE -- the "N need a decision · M
    // re-uploaded" template, not the frame's literal numerals.
    await waitFor(() => {
      expect(screen.getByText('3 need a decision · 2 re-uploaded')).toBeInTheDocument();
    });
  });

  it('draws the Select toggle beside the summary line, absent from the selecting-meta row (frame :207)', async () => {
    verbatimLine(
      207,
      '          <a href="#" style="margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:inline-flex; align-items:center; white-space:nowrap">Select</a>',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: threeRowEnvelope(),
    });

    renderContentApp();

    await waitFor(() => {
      expect(screen.getByText('3 need a decision · 2 re-uploaded')).toBeInTheDocument();
    });

    // PRODUCT bytes: the frame's <a href="#"> is shipped as a real <button>
    // (a semantic upgrade, not a divergence -- an anchor with no href
    // target would fail the 44px-floor interactive-control contract's own
    // "real control" spirit). One toggle, mutually exclusive with the
    // selecting-meta row this same suite proves below.
    const toggle = screen.getByRole('button', { name: 'Select' });
    expect(toggle).toBeInTheDocument();
    expect(document.querySelector('.chq-content-phone-selecting-meta')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(document.querySelector('.chq-content-phone-selecting-meta')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByText('3 need a decision · 2 re-uploaded')).not.toBeInTheDocument();
  });

  it('draws the two-chip strip labels verbatim from the ONE status-label map (frame :210/:211, SessionList.tsx:40)', async () => {
    verbatimLine(
      210,
      '          <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:600">Needs a decision · 5</span>',
    );
    verbatimLine(
      211,
      '          <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:500">Approved · 9</span>',
    );

    // PROVE the label reaches the DOM in a real mount -- not a source scan.
    // TAB_LABELS is the single map worklist.ts/SessionList.tsx (:40) both
    // key off; importing it here (not re-typing the strings) means a label
    // edit at the source breaks THIS assertion too, never silently drifts.
    expect(TAB_LABELS.needs_decision).toBe('Needs a decision');
    expect(TAB_LABELS.approved).toBe('Approved');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: threeRowEnvelope(),
    });

    renderContentApp();

    await waitFor(() => {
      expect(screen.getByText('3 need a decision · 2 re-uploaded')).toBeInTheDocument();
    });

    const chipstrip = document.querySelector('.chq-chipstrip');
    expect(chipstrip).not.toBeNull();
    const chips = within(chipstrip as HTMLElement);

    // Frame's chip strip draws exactly two chips (Needs a decision,
    // Approved); the shipped chipstrip carries a third tab ('All accepted
    // sessions', WORKLIST_TABS' third entry, DEC-825) the frame's :198
    // extent never draws. DIVERGES, ADJUDICATED: the third chip STAYS per
    // DEC-919 wave-28 amendment, ruling recorded in
    // `docs/design/DEVIATIONS.md` §7 -- a filter tab is a capability
    // (re-line-never-remove), and the frame's own phone chip row draws a
    // scrolling strip (`overflow-x:auto`), so a member past the drawn
    // viewport is a drawing boundary, not an omission. See
    // docs/design/audit/content-landing-390-v12.md for the full row.
    const needsDecisionChip = chips.getByRole('tab', { name: /^Needs a decision/ });
    const approvedChip = chips.getByRole('tab', { name: /^Approved/ });
    const allChip = chips.getByRole('tab', { name: /^All accepted sessions/ });
    expect(needsDecisionChip).toHaveTextContent('Needs a decision · 3');
    expect(approvedChip).toHaveTextContent('Approved · 9');
    expect(allChip).toBeInTheDocument();
    expect(chips.getAllByRole('tab')).toHaveLength(3);

    // The strip SCROLLS, it never wraps -- the frame's own phone chip row
    // is the authority for this (`overflow-x:auto;
    // -webkit-overflow-scrolling:touch`), and it is what makes the third
    // (and any further) chip a drawing-boundary matter rather than a
    // removed capability.
    const stylesSource = readFileSync(STYLES_FILE, 'utf-8');
    const stripRule = ruleBody(stylesSource, '.chq-chipstrip');
    expect(stripRule).toMatch(/overflow-x:\s*auto/);
    const stripChildRule = ruleBody(stylesSource, '.chq-chipstrip > *');
    expect(stripChildRule).toMatch(/flex-shrink:\s*0/);

    // Every chip clears the 44px tap floor the frame draws on its own
    // chips (`min-height:44px`, :210/:211) -- the phone rule, not a
    // desktop-only assumption. Two rules cooperate: the multi-selector
    // group rule sets `min-height: 44px` and `.chq-pill`'s own follow-on
    // rule adds `min-width: 44px` for short labels (styles.css's own
    // comment beside it explains why).
    const phoneBlock = stylesPhoneBlock();
    const pillPhoneRule = ruleBody(phoneBlock, '.chq-pill');
    expect(pillPhoneRule).toMatch(/min-width:\s*44px/);
    const sharedFloorMatch = phoneBlock.match(/\.chq-pill,\s*\.chq-rail-link,\s*\.chq-checkbox-label,\s*\.chq-btn-tertiary\s*\{([^}]*)\}/);
    expect(sharedFloorMatch, 'no .chq-pill shared phone floor rule').not.toBeNull();
    expect(sharedFloorMatch![1]).toMatch(/min-height:\s*44px/);
  });

  it('draws every row (title/meta/status) and the Approve+Open verb pair, across ALL rows the fixture renders (frame :217-224, DEC-180)', async () => {
    verbatimLine(217, '          <div style="padding:16px 0; border-bottom:1px solid #E1DDCE; display:flex; flex-direction:column; gap:9px">');
    verbatimLine(219, '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:17px; font-weight:600; letter-spacing:-0.02em; line-height:1.3">{{ row.title }}</span>');
    verbatimLine(220, '            <span style="font-size:13px; color:#565A4B; line-height:1.5">{{ row.speaker }} · {{ row.file }}, {{ row.when }}</span>');
    verbatimLine(222, '              <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Approve</span>');
    verbatimLine(223, '              <span style="flex:1; border:1px solid #CFC7B7; background:#EFEBDF; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#2E2A24">Open</span>');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: threeRowEnvelope(),
    });

    renderContentApp();

    await waitFor(() => {
      expect(screen.getByText('3 need a decision · 2 re-uploaded')).toBeInTheDocument();
    });

    const table = document.querySelector('.chq-content-worklist-table');
    expect(table).not.toBeNull();
    const rows = within(table as HTMLElement).getAllByRole('row').slice(1); // drop header row
    expect(rows).toHaveLength(3);

    const expectedTitles = [
      'Scaling Postgres Past a Billion Rows',
      'Type-Safe Feature Flags',
      'Consensus Without Coordination',
    ];

    rows.forEach((row, i) => {
      const scoped = within(row);
      // Title -- {{ row.title }}.
      expect(scoped.getByText(expectedTitles[i]!)).toBeInTheDocument();
      // Status pill -- {{ row.status }} (worklistStatusLabel's mapped text).
      expect(scoped.getByRole('cell', { name: /Not reviewed|Re-uploaded|Changes requested|Approved/ })).toBeInTheDocument();
      // Meta line -- {{ row.speaker }} · {{ row.file }}, {{ row.when }} is
      // shipped as three DOM cells (speaker / latest-file / relative date),
      // merged onto one flex line only by content.css's phone block (proved
      // by ContentApp.worklist-390.render.test.tsx's own suite) -- graded
      // here by PRESENCE, not by re-deriving that CSS proof.
      // Per-row verbs -- Approve + Open, both present, every row (none of
      // the three fixture rows is 'approved', so Approve is never withheld
      // -- SessionList.tsx's own conditional never fires here).
      expect(scoped.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
      expect(scoped.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    });

    // Speaker cell content, enumerated per row (not two samples): a bare
    // name, a name with a '+N' overflow count, and the 'No speakers' empty
    // state -- all three shapes SessionList.tsx's speaker cell draws.
    expect(within(rows[0]!).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/Grace Hopper/)).toHaveTextContent('Grace Hopper +1');
    expect(within(rows[2]!).getByText('No speakers')).toBeInTheDocument();
  });

  it("re-derives the stacked-card-vs-table-row hypothesis: content.css's terminal phone block already collapses THIS worklist table to the frame's :217-224 card anatomy", () => {
    // content-v12.md's :198 row calls the shape gap genuine -- checked
    // fresh here rather than inherited (DEC-976 wave-25: neighbouring rows
    // in that same file went stale after their fixes landed). The sibling
    // suite (ContentApp.worklist-390.render.test.tsx) already proves this
    // same ROW selector collapses to a flex card with the frame's status/
    // title/meta/actions order at the terminal 700px breakpoint; this test
    // re-runs the same proof against the identical selector so a claim
    // resting on it is independently verified, not just cited.
    const ROW = '.chq-content-worklist .chq-content-table tr.chq-content-row';
    const body = contentPhoneBlock();
    const row = ruleBody(body, ROW);
    expect(row).toMatch(/display:\s*flex/);
    expect(row).toMatch(/flex-wrap:\s*wrap/);

    const statusOrder = Number(ruleBody(body, `${ROW} > td:nth-child(5)`).match(/order:\s*(\d+)/)![1]);
    const titleOrder = Number(ruleBody(body, `${ROW} > td:nth-child(2)`).match(/order:\s*(\d+)/)![1]);
    const speakerOrder = Number(ruleBody(body, `${ROW} > td:nth-child(3)`).match(/order:\s*(\d+)/)![1]);
    const actionsOrder = Number(ruleBody(body, `${ROW} > td:nth-child(6)`).match(/order:\s*(\d+)/)![1]);

    // MATCHES: status, then title, then the speaker/file meta line, then
    // actions last -- the frame's :217-224 stack order, reached via CSS
    // `order` on the existing table markup rather than a genuine
    // table-to-card architectural rewrite.
    expect(statusOrder).toBeLessThan(titleOrder);
    expect(titleOrder).toBeLessThan(speakerOrder);
    expect(speakerOrder).toBeLessThan(actionsOrder);
  });
});
