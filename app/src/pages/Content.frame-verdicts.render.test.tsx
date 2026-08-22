// w13-ra (DEC-976 wave-157): the phone CLAIMED_FLOOR row for the Content
// cluster reads 53/53 event-wide, but NONE of Content's four width:390px
// frames (docs/design/Chautauqua Content.dc.html, caption lines 198, 247,
// 338 and 373 -- each cited with its own verbatim receipt beside the it()
// that renders it, never from this header) had ever been RENDERED against
// the tree -- Content is recorded as
// 'DONE' in docs/mobile-campaign.md on the strength of a probe, not a
// render receipt. This task builds that receipt, modelled EXACTLY on
// Settings.frame-verdicts.render.test.tsx (DEC-976 amendment wave 154,
// task w10-ne): one it() per frame, each opening with a verbatimLine()
// citation of the frame's own caption line (so it cannot silently rot to
// the wrong line), rendering through the REAL route
// (<MemoryRouter><ContentApp/></MemoryRouter>, never a sub-component
// mounted directly), and stating MATCHES/DIVERGES with the divergence
// named. A DIVERGES verdict is a FINDING, not a failure -- this file must
// stay green while it records that a screen does not match, exactly like
// the Settings file. Prose lives in docs/design/audit/content-v12.md; this
// file is the render RECEIPT each verdict row there cites.
//
// jsdom applies no stylesheet (no @media), so every assertion below is
// about DOM STRUCTURE/ORDER, never computed geometry -- consistent with
// every other render-test file in this cluster. The :198 and :373 it()s
// (w12-xc, DEC-976 wave-12) additionally read content.css's terminal
// max-width:700px block as TEXT, the same split FilesLibrary.render.test
// .tsx and DeliverableDetail.stack-390.render.test.tsx already use --
// jsdom's silence on @media makes a DOM-only assertion a claim about the
// desktop cascade, not the phone one, so a screen-level MATCHES verdict
// needs the stylesheet's own text as its receipt.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContentApp } from './content/ContentApp';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');
const CSS_FILE = join(HERE, 'content', 'content.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches
 * the literal this file claims -- a citation that can never silently rot
 * to a wrong line the way a bare `:line` reference can. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** Isolate content.css's ONE terminal max-width:700px block, brace-matched
 * so a nested `{...}` inside it never truncates the slice early. Copied
 * from DeliverableDetail.stack-390.render.test.tsx's own `phoneBlock`
 * (itself copied from DeliverableDetail.render.test.tsx's `detailPhoneBlock`). */
function phoneBlock(): string {
  const source = readFileSync(CSS_FILE, 'utf-8');
  const open = source.indexOf('@media (max-width: 700px) {');
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

/** A selector can legitimately recur within the phone block (an earlier
 * generic rule plus a later, more specific one) -- concatenate every
 * matching body rather than taking only the first, so a later declaration
 * is never silently missed. Copied from DeliverableDetail.stack-390.render
 * .test.tsx's own `phoneRule`. */
function phoneRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  expect(matches.length, `no phone rule for \`${selector}\``).toBeGreaterThan(0);
  return matches.map((m) => m[1]).join('\n');
}

function ruleOrder(body: string): number {
  const m = body.match(/order:\s*(-?\d+)/);
  expect(m, `no order: declaration in \`${body}\``).not.toBeNull();
  return Number(m![1]);
}

const EVENT_ID = 'evt-content-frame-verdicts';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

// DEC-935: mirrors App.tsx's own two <Route>s for /content (worklist) and
// /content/:submissionId (deliverable detail) -- both render the SAME
// ContentApp component (copied from ContentApp.render.test.tsx's own
// renderContentApp helper), so this file mounts it under the real route
// shape rather than at a bare "/".
function renderContentApp(initialPath = '/content') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/content/:submissionId" element={<ContentApp />} />
        <Route path="/content" element={<ContentApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

// GET /api/v1/me (DEC-024) is fetched unconditionally by the shared
// `useMe` hook some content sub-views mount (comment authoring) --
// registered in every mockApi() call below so an unrelated route-not-found
// throw never masks the frame verdict itself.
const ME_ENVELOPE = { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' };

const oneWorklistRow = {
  id: 'sub-1',
  ref: 'DFC-014',
  title: 'Taming 40-Minute CI',
  status: 'accepted',
  contentStatus: 'changes_requested',
  speakers: [{ contactId: 'c1', name: 'Priya Raman' }],
  trackIds: [],
  submittedAt: null,
  createdAt: 1700000000000,
  latestFile: { filename: 'slides-v3.pdf', kind: 'presentation', versionCount: 3, uploadedAt: 1700000100000 },
  latestFileByKind: { presentation: 3 },
  reuploaded: true,
};

describe('v12 Content 390 frames: per-frame render verdict receipts (w13-ra, DEC-976)', () => {
  // Frame :198-238 "Content" -- caption at :195.
  //
  // w12-xc (DEC-976 wave-12): retitled from a DOM-order DIVERGES to a
  // CSS-text MATCHES. content.css's terminal `@media (max-width: 700px)`
  // block (`.chq-content-table thead { display: none }` plus
  // `.chq-content-table, tbody, tr, td { display: block }`) already turns
  // every worklist row into a card, and the row's own per-cell `order`
  // sequence (select < status < session < speaker/file < actions) draws
  // the status pill AHEAD of the title, matching the frame's status-first
  // card even though the underlying element stays a `<table>`/`<tr>` (a
  // DOM fact, never the screen fact this verdict is about -- the same
  // distinction `docs/design/audit/submissions-v12.md`'s clause-(b)
  // closure for its own `:137` row draws, and already recorded CLOSED at
  // `docs/design/audit/content-v12.md:79/278`). Underlying DOM assertions
  // are kept below (still true facts) alongside the new CSS-text reads
  // that prove the reflow.
  it('frame :198 Content worklist -- MATCHES (screen fact; DOM fact is unchanged): content.css\'s terminal phone block hides <thead>, collapses the table to block rows, and reorders each cell so the status pill draws ahead of the title, exactly as the frame\'s status-first stacked card reads on screen', async () => {
    verbatimLine(195, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Content</span>");
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([oneWorklistRow], {
        contentStatusCounts: { pending: 0, approved: 9, changes_requested: 5 },
        reuploadedCount: 2,
      }),
      'GET /api/v1/me': ME_ENVELOPE,
    });

    renderContentApp();

    // The frame's header line reads "5 need a decision · 2 re-uploaded" --
    // this matches (DEC-913's grouped-aggregate headline).
    await waitFor(() => {
      expect(screen.getByText('5 need a decision · 2 re-uploaded')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Content' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();

    // DOM fact (unchanged by the phone media query, jsdom applies none of
    // it): the row is a <table> <tr> whose first cell is a per-row
    // selection checkbox (DEC-825 amendment) ahead of the Session cell,
    // with Speaker / Latest file / Status as three separate cells.
    const row = document.querySelector<HTMLElement>('tr.chq-content-row');
    if (!row) throw new Error('worklist row not found');
    expect(within(row).getByRole('checkbox', { name: 'Select Taming 40-Minute CI' })).toBeInTheDocument();
    const cells = row.querySelectorAll('td');
    // cell 0 = select, 1 = session (title+ref), 2 = speaker, 3 = latest
    // file, 4 = status, 5 = actions.
    expect(cells).toHaveLength(6);
    expect(cells[1]).toHaveTextContent('Taming 40-Minute CI');
    expect(cells[2]).toHaveTextContent('Priya Raman');
    expect(cells[4]).toHaveTextContent('Re-uploaded');
    expect(within(row).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Open' })).toBeInTheDocument();

    // Screen fact (what content.css's phone block actually paints):
    // <thead> hidden, the table/tbody/tr/td collapsed to block rows so
    // each <tr> reads as a card, not a table.
    const phone = phoneBlock();
    expect(phoneRule(phone, '.chq-content-table thead')).toMatch(/display:\s*none/);
    const collapsed = phoneRule(phone, '.chq-content-table,\n  .chq-content-table tbody,\n  .chq-content-table tr,\n  .chq-content-table td');
    expect(collapsed).toMatch(/display:\s*block/);

    // The row becomes a wrapping flex line-box, and the per-cell `order`
    // sequence puts status (td:nth-child(5)) AHEAD of session
    // (td:nth-child(2)), which is itself ahead of speaker/latest-file
    // (td:nth-child(3)/(4)) and the actions pair (td:nth-child(6)) --
    // select < status < session < speaker/file < actions, the frame's
    // own tick-then-status-then-title-then-meta-then-actions card.
    const rowFlex = phoneRule(phone, '.chq-content-worklist .chq-content-table tr.chq-content-row');
    expect(rowFlex).toMatch(/display:\s*flex/);
    expect(rowFlex).toMatch(/flex-wrap:\s*wrap/);

    const selectOrder = ruleOrder(phoneRule(phone, '.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(1)'));
    const statusOrder = ruleOrder(phoneRule(phone, '.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(5)'));
    const sessionOrder = ruleOrder(phoneRule(phone, '.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(2)'));
    const speakerOrder = ruleOrder(phoneRule(phone, '.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(3)'));
    const latestFileOrder = ruleOrder(phoneRule(phone, '.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(4)'));
    const actionsOrder = ruleOrder(phoneRule(phone, '.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(6)'));

    expect(selectOrder).toBeLessThan(statusOrder);
    expect(statusOrder).toBeLessThan(sessionOrder);
    expect(sessionOrder).toBeLessThan(speakerOrder);
    expect(speakerOrder).toBeLessThanOrEqual(latestFileOrder);
    expect(latestFileOrder).toBeLessThan(actionsOrder);
  });

  // Frame :247-284 "Content · selecting" -- caption at :243.
  it('frame :247 Content selecting -- DIVERGES: no per-row check icon, and the bar renders inside the worklist column rather than as the header\'s own footer (w15-ta, DEC-825 wave-159: the idle summary line used to stay mounted alongside "N selected" too -- ContentApp.tsx now guards it on !phoneSelectMode, so that part MATCHES)', async () => {
    verbatimLine(243, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Content · selecting</span>");
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([oneWorklistRow], {
        contentStatusCounts: { pending: 0, approved: 9, changes_requested: 5 },
        reuploadedCount: 2,
      }),
      'GET /api/v1/me': ME_ENVELOPE,
    });

    renderContentApp();

    await screen.findByRole('button', { name: 'Select' });
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));

    // The header's "selecting" meta row (w1-e) matches the frame's
    // "N selected / All N / Done" line (:255-257) and now REPLACES the
    // rest-state summary line, per !phoneSelectMode guards on both
    // clauses (w15-ta, DEC-825 wave-159) -- "N need a decision · M
    // re-uploaded" (frame :198-203's OWN idle-state text) is gone while
    // selecting, exactly as the frame's :247-263 head draws it.
    expect(await screen.findByText('0 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByText('5 need a decision · 2 re-uploaded')).not.toBeInTheDocument();

    // Frame :266-273 draws a leading check-mark glyph on each row ahead of
    // the status pill -- the real row instead carries the SAME plain
    // checkbox input the rest-state worklist row does (DEC-825's one
    // selection model, no second UI for select mode), which this test
    // must find to prove the divergence rather than assume it.
    const row = document.querySelector<HTMLElement>('tr.chq-content-row');
    if (!row) throw new Error('worklist row not found');
    expect(within(row).getByRole('checkbox', { name: 'Select Taming 40-Minute CI' })).toBeInTheDocument();
    expect(within(row).queryByText('✓')).not.toBeInTheDocument();

    // Frame :278-283 draws the "Approve 2"/consequence-line footer pinned
    // to the SCREEN'S bottom, outside the row list. The real bulk bar
    // (role=toolbar) is a sibling of the table INSIDE the same
    // `.chq-content-worklist` scroller, not the header's own row.
    const bar = screen.getByRole('toolbar', { name: 'Bulk content actions' });
    const worklist = document.querySelector('.chq-content-worklist');
    expect(worklist).not.toBeNull();
    expect(worklist!.contains(bar)).toBe(true);
  });

  // Frame :338-368 "Files · 390" -- caption at :334.
  it('frame :338 Files library (phone) -- DIVERGES (narrowed, DEC-967 wave-21): the leading chip\'s ACCESSIBLE NAME is pinned to "All types" at every width while the frame draws bare "All" (the drawn word itself now matches), and the header row (not the frame\'s stat line alone) carries a Download-all control the frame reserves for the footer dock', async () => {
    verbatimLine(334, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Files · 390</span>");
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(
        [
          {
            rootFileId: 'file-v1',
            latestFileId: 'file-v3',
            filename: 'slides-v3.pdf',
            kind: 'presentation',
            submissionId: 'sub-1',
            submissionRef: 'DFC-014',
            submissionTitle: 'Taming 40-Minute CI',
            speakerName: 'Priya Raman',
            uploadedAt: 1700000100000,
            versionCount: 3,
            versionNo: 3,
            sizeBytes: 4096,
            uploaderName: 'Priya Raman',
          },
        ],
        { total: 31, totalSizeBytes: 412 * 1024 * 1024, kindCounts: { presentation: 22, recording: 4, handout: 5 } },
      ),
      'GET /api/v1/me': ME_ENVELOPE,
    });

    renderContentApp('/content?view=files');

    await screen.findByRole('button', { name: '‹ Content' });
    expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument();
    // Frame :340 states "31 files · 412 MB" under the H1 -- the real stat
    // line now MATCHES: formatBytes (src/domain/files.ts, DEC-613 wave-17
    // amendment) trims a trailing ".0" for an integral value, so 412 MB
    // renders bare, exactly as the frame draws it.
    expect(screen.getByText('31 files · 412 MB')).toBeInTheDocument();

    // CLOSED (DEC-613 wave-159, retired here under DEC-967 wave-20/21 with
    // the tree evidence quoted inline): the kind-chip VOCABULARY now MATCHES
    // the frame. app/src/pages/content/types.ts declares
    // `recording: 'Video'` on LIBRARY_KIND_LABELS in its own right instead of
    // inheriting DELIVERABLE_LABELS' 'Recording', which the SESSION
    // deliverable strip (:141/:387) keeps -- two registers for one domain
    // kind, split by surface. The leading chip's visible text matches too:
    // app/src/pages/content/FilesLibrary.tsx renders
    // `{isPhone ? 'All' : 'All types'}`, so 390 draws the frame's bare "All".
    //
    // What still DIVERGES is the leading chip's ACCESSIBLE NAME: the same
    // element pins `aria-label="All types"` at every width on purpose, so the
    // tab's identity does not change with viewport while its drawn word does.
    // The queries below are by accessible name, which is why 'All types'
    // resolves and 'All' does not. This ledger mounts at jsdom's default
    // width and stubs no matchMedia, so the DRAWN word here is the desktop
    // register; the phone register is pinned separately, and by width, in
    // app/src/pages/content/FilesLibrary.kind-vocabulary.render.test.tsx
    // ('phone (390): the leading chip renders "All" visible text but keeps
    // "All types" as its accessible name').
    expect(screen.queryByRole('tab', { name: 'All' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All types' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Slides · 22' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Video · 4' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Recording · 4' })).not.toBeInTheDocument();

    // Frame :338-368 reserves "Download all"/"Search" for the sticky
    // footer dock (:365-367) -- the header row above the chips carries no
    // download control at all in the mock. The real header row DOES mount
    // a "Download all N (.zip)" secondary beside the stat line, ahead of
    // the toolbar -- a second copy of the same capability the footer dock
    // also renders (content.css/FilesLibrary.tsx comment already names
    // this as deliberate, wave-125 amendment), not what the frame draws.
    const headerRow = document.querySelector<HTMLElement>('.chq-content-files-header-row');
    expect(headerRow).not.toBeNull();
    // (Reads "Download 1 file (.zip)" rather than "Download all N" because
    // this fixture's one item is fewer than `total` -- the scoped-count
    // wording, same handler, still the header row's own copy of the
    // capability.)
    expect(within(headerRow!).getByRole('button', { name: /Download/ })).toBeInTheDocument();

    // The footer dock itself DOES match: primary "Download all" beside a
    // bordered "Search" secondary.
    const dock = document.querySelector('.chq-phone-dock');
    expect(dock).not.toBeNull();
    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons.map((b) => b.textContent)).toEqual(['Download 1 file (.zip)', 'Search']);
  });

  // Frame :373-419 "Session · deliverable" -- caption at :369.
  //
  // w12-xc (DEC-976 wave-12): retitled from a DOM-order DIVERGES to a
  // CSS-text MATCHES. w15-tc (DEC-989 wave-159) folded
  // `.chq-content-group-body { display: flex; flex-direction: column }`
  // plus `display: contents` on both column wrappers and CommentThread's
  // own root into content.css's terminal phone block, which hoists every
  // grandchild into ONE ordered flex column -- version rows, notes label,
  // comment rows, upload link, then the note textbox, exactly the frame's
  // single stacked scroll -- even though the desktop two-column DOM (a DOM
  // fact) is left untouched above the block's 700px ceiling (DEC-385
  // single-direction). Already recorded CLOSED at
  // `docs/design/audit/content-v12.md:82/365`; modelled on
  // `DeliverableDetail.stack-390.render.test.tsx`'s own `phoneBlock`/
  // `phoneRule` idiom.
  it('frame :373 Session deliverable detail -- MATCHES (screen fact; DOM fact is unchanged): content.css\'s terminal phone block turns the two DOM columns and CommentThread\'s root into display:contents and orders every grandchild into the frame\'s single stacked scroll (versions -> notes label -> comment rows -> upload link -> note textbox)', async () => {
    verbatimLine(369, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Session · deliverable</span>");
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([oneWorklistRow]),
      [`GET /api/v1/submissions/sub-1`]: {
        id: 'sub-1',
        ref: 'DFC-014',
        updatedAt: 1700000200000,
        participants: [{ name: 'Priya Raman', contactId: 'c1' }],
        slot: null,
        reuploaded: true,
        contentStatus: 'changes_requested',
      },
      [`GET /api/v1/submissions/sub-1/files`]: listEnvelope([
        {
          id: 'file-v3',
          kind: 'presentation',
          filename: 'slides-v3.pdf',
          versionNo: 3,
          uploadedAt: 1700000100000,
          sizeBytes: 4096,
          uploaderName: 'Priya Raman',
        },
      ]),
      [`GET /api/v1/files/file-v3/comments`]: listEnvelope([
        { id: 'c1', who: 'Ada', when: '8 days ago', text: 'Please trim the intro.' },
      ]),
      'GET /api/v1/me': ME_ENVELOPE,
    });

    renderContentApp('/content/sub-1');

    // Frame :373-380 header lines: back link, H1 title, "Speaker · CODE",
    // content-status band with a same-row Approve. These match.
    expect(await screen.findByRole('button', { name: '‹ Content' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Taming 40-Minute CI' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/DFC-014/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();

    // DOM fact (jsdom applies no @media, so this is unchanged by the
    // phone block below): the body is still two side-by-side <div>
    // columns (.chq-content-files-col / .chq-content-comments-col),
    // siblings of one shared parent.
    const body = document.querySelector('.chq-content-group-body');
    expect(body).not.toBeNull();
    const filesCol = body!.querySelector('.chq-content-files-col');
    const commentsCol = body!.querySelector('.chq-content-comments-col');
    expect(filesCol).not.toBeNull();
    expect(commentsCol).not.toBeNull();
    expect(filesCol!.parentElement).toBe(commentsCol!.parentElement);

    // Screen fact (what content.css's phone block actually paints): the
    // group body becomes a flex column, and both column wrappers plus
    // CommentThread's own root turn `display: contents` so their real
    // children become flex items of the shared parent directly.
    const phone = phoneBlock();
    const groupBodyRule = phoneRule(phone, '.chq-content-group-body');
    expect(groupBodyRule).toMatch(/display:\s*flex/);
    expect(groupBodyRule).toMatch(/flex-direction:\s*column/);
    const hoisted = phoneRule(
      phone,
      '.chq-content-group-body > .chq-content-files-col,\n  .chq-content-group-body > .chq-content-comments-col,\n  .chq-content-group-body .chq-comment-thread',
    );
    expect(hoisted).toMatch(/display:\s*contents/);

    // Each grandchild is placed with `order` in the frame's own drawn
    // sequence: version rows < notes label < comment rows < upload link <
    // note textbox.
    const versionRowsOrder = ruleOrder(
      phoneRule(
        phone,
        '.chq-content-group-body .chq-content-files-col > .chq-content-version-list,\n  .chq-content-group-body .chq-content-files-col > .chq-error,\n  .chq-content-group-body .chq-content-files-col .chq-empty-block',
      ),
    );
    const notesLabelOrder = ruleOrder(phoneRule(phone, '.chq-content-group-body .chq-content-notes-label'));
    const commentRowsOrder = ruleOrder(
      phoneRule(
        phone,
        '.chq-content-group-body .chq-content-comments-col .chq-content-comment-list,\n  .chq-content-group-body .chq-content-comments-col .chq-empty-block',
      ),
    );
    const uploadLinkOrder = ruleOrder(phoneRule(phone, '.chq-content-group-body .chq-content-upload-zone'));
    const noteTextboxOrder = ruleOrder(phoneRule(phone, '.chq-content-group-body .chq-comment-composer'));

    expect(versionRowsOrder).toBeLessThan(notesLabelOrder);
    expect(notesLabelOrder).toBeLessThan(commentRowsOrder);
    expect(commentRowsOrder).toBeLessThan(uploadLinkOrder);
    expect(uploadLinkOrder).toBeLessThan(noteTextboxOrder);

    await waitFor(() => {
      expect(within(filesCol as HTMLElement).getByText('slides-v3.pdf')).toBeInTheDocument();
    });
    expect(within(commentsCol as HTMLElement).getByText('Notes on the slides')).toBeInTheDocument();
    // The "Upload a file for the speaker" affordance (frame :415) lives in
    // the LEFT (files) column, not appended after the notes thread the
    // way the frame's single stack draws it. (UploadZone renders both a
    // desktop and a phone prompt string on the same control; jsdom applies
    // no @media so both text nodes coexist here -- querying the phone
    // prompt specifically, which is the one the frame's own copy matches.)
    expect(within(filesCol as HTMLElement).getByText('Upload a file for the speaker')).toBeInTheDocument();
  });
});
