// w14-sb (DEC-976 wave-157/158): the Submissions cluster's per-frame 390
// render-verdict ledger. Modelled EXACTLY on
// Settings.frame-verdicts.render.test.tsx -- same verbatimLine helper, same
// beforeEach/afterEach, same mockApi/listEnvelope usage. MEASUREMENT ONLY:
// this task fixes nothing, touches no .css and no component.
//
// FRAMES (docs/design/Chautauqua Submissions.dc.html): :137 'Submissions',
// :355 'Submission detail', :468 'CFP form · 390'. Route ownership per the
// planner's disambiguation of :468 (its caption 'Reorder and edit one
// question at a time', back link '‹ Submissions', H1 'CFP form' is the
// admin form BUILDER, app/src/pages/forms/FormsPage.tsx -- NOT the public
// SSR CFP). :137 enters via Submissions.tsx (a thin wrapper over
// submissions/SubmissionsTable.tsx); :355 enters via
// submissions/SubmissionDetailPage.tsx at its real /submissions/:id route.
//
// jsdom applies no stylesheet (no @media), so every assertion below is
// about DOM STRUCTURE/ORDER, never computed geometry -- consistent with
// every other render-test file in this campaign.
//
// Each `docs/design/Chautauqua Submissions.dc.html:<line>` citation below is
// followed by its backtick-quoted literal (frame-citation.scan.test.ts's
// UNRECEIPTED_CLAIM_CEILING), then within 6 raw lines by a real product
// `expect(` -- literals are pulled from named consts declared up top so the
// citation/quote/verbatimLine/expect quartet fits the proximity window.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionsPage } from './Submissions';
import { SubmissionDetailPage } from './submissions/SubmissionDetailPage';
import { FormsPage } from './forms/FormsPage';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests, resetInitialStoredIdForTests } from '../lib/useCurrentEvent';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Submissions.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- a citation that can never silently rot to a
 * wrong line the way a bare `:line` reference can. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// Frame :137 "Submissions" literals.
const L137 =
  '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">';
const L144 =
  '          <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Submissions</h1>';
const L147 =
  '        <div style="border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:14px; color:#565A4B; background:#FAF8F2">Search title or speaker…</div>';
const L149 =
  '          <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:600">Needs triage</span>';
const L165 =
  '              <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Accept</span>';

// Frame :355 "Submission detail" literals.
const L355 =
  '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">';
const L358 =
  '          <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Triage</a>';
const L362 =
  "        <h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.2\">Docs That Answer Back: Retrieval-Grounded Documentation Sites</h1>";
const L363 = '        <span style="font-size:13px; color:#565A4B">Dana Whitmore · Fieldnote Docs</span>';
const L367 =
  "        <p style=\"margin:0; font-size:15px; line-height:1.65; color:#3F4237\">A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run.</p>";
const L375 =
  "          <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase\">Reviews · 3 of 3 in</span>";

// Frame :468 "CFP form · 390" literals.
const L468 =
  '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">';
const L470 =
  '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Submissions</a>';
const L471 =
  "        <h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05\">CFP form</h1>";
const L472 = '        <span style="font-size:13px; color:#565A4B">Closes 16 Aug · 47 received</span>';
const L476 = '            <span style="font-size:16px; color:#8E8A7A">⋮⋮</span>';
const L481 =
  '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Edit</span>';
const L484 =
  '        <span style="display:flex; align-items:center; justify-content:center; margin-top:14px; border:1px dashed #BAB6A6; border-radius:6px; min-height:46px; font-size:13px; font-weight:700; color:#4E5C31">Add a question</span></div>';
const L486 =
  '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save the form</span>';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  // useCurrentEvent.ts's own test-only seam: navigationContexts is keyed by
  // location.search, which every MemoryRouter default entry ('/') shares
  // across it()s in this file -- without this reset the second/third test's
  // fromStorage read replays the FIRST test's frozen pre-render snapshot
  // (its own EVENT_ID), not the localStorage value this test just set.
  resetInitialStoredIdForTests();
  resetEventsCacheForTests();
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

describe('v12 Submissions 390 frames: per-frame render verdict receipts (w14-sb, DEC-976)', () => {
  // Frame :137-172 "Submissions".
  it("frame :137 Submissions -- DIVERGES (narrowed further, DEC-976 wave-12): head band (H1, summary, search, chip strip) matches the frame's order and the active-status chip now DRAWS the frame's own \"Needs triage\" words at phone (keeping \"Pending\" as its pinned accessible name); submissions.css's terminal max-width:700px block hides <thead> and re-lines the worklist's <td> cells into the frame's own card sequence -- ref+status baseline, then title, then speakers/track/sent, then the row actions -- so this is no longer a desktop <table> masquerading as a card; the surviving divergence is the ADDED select-checkbox cell (order:2, sharing the ref/status baseline line) that the frame draws no counterpart for", async () => {
    const EVENT_ID = 'evt-submissions-frame-137';
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);

    mockApi({
      'GET /api/v1/me': { userId: 'u-self', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(
        [
          {
            id: 'sub-1',
            ref: 'S-001',
            title: 'A Talk About Testing',
            status: 'pending',
            contentStatus: 'pending',
            speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
            trackIds: [],
            submittedAt: null,
            createdAt: 1700000000000,
          },
        ],
        { total: 47 },
      ),
    });

    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );

    // docs/design/Chautauqua Submissions.dc.html:137
    // `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(137, L137);
    expect(screen.getByRole('heading', { name: 'Submissions' }).tagName).toBe('H1');

    // docs/design/Chautauqua Submissions.dc.html:144-145
    // `          <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Submissions</h1>`
    verbatimLine(144, L144);
    const h1 = screen.getByRole('heading', { name: 'Submissions' });
    expect(h1).toBeInTheDocument();

    // docs/design/Chautauqua Submissions.dc.html:147
    // `        <div style="border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:14px; color:#565A4B; background:#FAF8F2">Search title or speaker…</div>`
    verbatimLine(147, L147);
    const search = screen.getByPlaceholderText('Search title or speaker…');
    // H1 -> search field, matching the frame's own top-to-bottom order.
    expect(h1.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    // docs/design/Chautauqua Submissions.dc.html:149
    // `          <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:600">Needs triage</span>`
    verbatimLine(149, L149);
    const pills = within(screen.getByRole('group', { name: 'Filter by status' }));
    const pendingPill = pills.getByRole('button', { name: 'Pending' });
    expect(pendingPill.querySelector('.chq-submissions-status-pending-phone')?.textContent).toBe('Needs triage');
    // CLOSED (commit ae6d8ec4, DEC-825 wave-16; retired here under DEC-967
    // wave-20/21 with the tree evidence quoted inline). The pending pill now
    // draws the frame's own words: app/src/pages/submissions/FilterBar.tsx
    // renders `<span className="chq-submissions-status-pending-phone">Needs
    // triage</span>` as a phone-only sibling of the desktop
    // `.chq-submissions-status-pending-desktop` span, with
    // `aria-label={status === 'pending' ? STATUS_LABELS.pending : undefined}`
    // pinning the accessible name to 'Pending' at every width so it never
    // changes across breakpoints. jsdom applies no @media, so BOTH spans sit
    // in the DOM here -- which is exactly why the accessible-name query above
    // still resolves 'Pending' while the frame's words are present too. The
    // note sits BELOW the first assertion because app/src/
    // frame-citation.scan.test.ts requires a real expect( within
    // EXPECT_PROXIMITY_LINES of the frame citation above it.
    expect(pendingPill.querySelector('.chq-submissions-status-pending-desktop')?.textContent).toBe('Pending');

    // docs/design/Chautauqua Submissions.dc.html:165-167
    // `              <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Accept</span>`
    verbatimLine(165, L165);
    const triage = within(screen.getByRole('group', { name: 'Triage S-001' }));
    const actionLabels = triage.getAllByRole('button').concat(triage.getAllByRole('link')).map((el) => el.textContent);
    expect(actionLabels).toEqual(['Accept', 'Decline', 'Read']);
    // The triage row's own action triple (Accept/Decline/Read) is present
    // in the frame's own order, though nested in a <table> row rather than
    // the frame's standalone stacked card.

    // Source-scan pin (jsdom applies no @media, so a DOM-order assertion
    // here cannot observe the phone re-line): submissions.css's terminal
    // max-width:700px block hides <thead> and re-lines the row's <td>
    // cells into the frame's own card sequence -- ref+status baseline
    // line, title, speakers/track/sent line, then the row actions -- the
    // CSS rule text itself is the drift-proof receipt (idiom copied from
    // Review.frame-verdicts.render.test.tsx's review.css check).
    const submissionsCssPath = join(REPO_ROOT, 'app', 'src', 'pages', 'submissions', 'submissions.css');
    const submissionsCss = readFileSync(submissionsCssPath, 'utf-8');
    expect(submissionsCss).toContain('.chq-submissions-table thead {\n    display: none;\n  }');
    // Baseline line 1: select-checkbox + ref + status pill (order:2) --
    // the ADDED cell the frame draws no counterpart for.
    expect(submissionsCss).toContain(
      '.chq-submissions-table tbody td:nth-child(1),\n  .chq-submissions-table tbody td:nth-child(2),\n  .chq-submissions-table tbody td:nth-child(6) {\n    order: 2;\n    width: auto;\n  }',
    );
    // Title (order:3), matching the frame's ref -> TITLE -> speakers ->
    // actions sequence.
    expect(submissionsCss).toContain('.chq-submissions-table tbody td:nth-child(3) {\n    order: 3;\n  }');
    // Speakers/track/sent line (order:4), matching the frame's
    // ref -> title -> SPEAKERS -> actions sequence.
    expect(submissionsCss).toContain(
      '.chq-submissions-table tbody td:nth-child(4),\n  .chq-submissions-table tbody td:nth-child(5),\n  .chq-submissions-table tbody td:nth-child(7),\n  .chq-submissions-table tbody .chq-submissions-table-custom {\n    order: 4;\n    width: auto;\n  }',
    );
    // The row actions cell carries no explicit order override here, so it
    // keeps the tbody td default (order:10, set above) -- after every
    // named band, matching the frame's trailing ACTIONS position.
    expect(submissionsCss).toContain('.chq-submissions-table tbody td {\n    display: block;\n    width: 100%;\n    order: 10;');
    // The select-checkbox cell is the one card slot the frame draws no
    // counterpart for -- it shares the ref/status baseline line (order:2)
    // rather than standing apart, so it is the surviving divergence, not
    // "a desktop table".
    expect(screen.getByRole('checkbox', { name: 'Select S-001' })).toBeInTheDocument();
  });

  // Frame :355-390 "Submission detail".
  it('frame :355 Submission detail -- MATCHES (clause (a) retired, DEC-976 wave-12; clause (b) CLOSED commit 023e1257, DEC-878): real content is present in the frame\'s own block order (ref/eyebrow -> title -> byline -> abstract -> answers -> reviews); the back link is a SINGLE anchor with two same-anchor spans (chq-detail-back-full \'All submissions\', chq-detail-back-short \'Triage\'), and detail.css\'s terminal max-width:700px block hides the full span and shows only the short one at phone width -- so the SCREEN reads the frame\'s own bare \'‹ Triage\', even though jsdom\'s no-@media DOM keeps both spans mounted here; the Abstract/Form answers H2s are screen-reader-only (chq-detail-section-title-frameless) inside the same terminal phone block, matching the frame\'s drawn anatomy at 390 with desktop byte-identical', async () => {
    const SUB_ID = 'sub-frame-355';

    mockApi({
      [`GET /api/v1/submissions/${SUB_ID}`]: {
        id: SUB_ID,
        eventId: 'evt-1',
        ref: 'DFC-033',
        title: 'Docs That Answer Back: Retrieval-Grounded Documentation Sites',
        description:
          "A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run.",
        status: 'pending',
        contentStatus: 'pending',
        trackId: null,
        trackIds: [],
        formId: null,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        participants: [
          {
            id: 'p1',
            contactId: 'c1',
            name: 'Dana Whitmore',
            email: 'dana@example.com',
            title: null,
            company: 'Fieldnote Docs',
            role: 'speaker',
            order: 0,
            visible: true,
            inviteStatus: 'accepted',
            submissionsThisYear: 1,
          },
        ],
        answers: {},
        answerFiles: [],
        slot: null,
      },
      'GET /api/v1/events/evt-1': { id: 'evt-1', timezone: 'UTC' },
      'GET /api/v1/events/evt-1/tracks': { items: [], total: 0, page: 1, perPage: 20 },
      'GET /api/v1/events/evt-1/forms': { id: 'form-1', fields: [] },
      [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 3 },
    });

    render(
      <MemoryRouter initialEntries={[`/submissions/${SUB_ID}`]}>
        <Routes>
          <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Docs That Answer Back: Retrieval-Grounded Documentation Sites')).toBeInTheDocument();
    });

    // docs/design/Chautauqua Submissions.dc.html:355
    // `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(355, L355);
    expect(screen.getByRole('heading', { name: /Docs That Answer Back/ })).toBeInTheDocument();

    // docs/design/Chautauqua Submissions.dc.html:358
    // `          <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Triage</a>`
    verbatimLine(358, L358);
    const backLink = screen.getByRole('link', { name: /All submissions/ });
    expect(backLink.textContent).toContain('Triage');
    // RETIRED (DEC-976 wave-12): this used to assert the frame's bare
    // '‹ Triage' anchor text never renders. False -- detail.css's terminal
    // max-width:700px block hides chq-detail-back-full and shows only
    // chq-detail-back-short ('Triage') at phone width, so the SCREEN
    // (not this jsdom DOM, which applies no @media and keeps both spans)
    // reads exactly the frame's own bare text. Source-scan receipt, same
    // idiom as the :367 abstract-heading check below.
    const detailCssForBack = readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'submissions', 'detail.css'), 'utf-8');
    expect(detailCssForBack).toContain('.chq-detail-back-full {\n    display: none;\n  }');
    expect(detailCssForBack).toContain('.chq-detail-back-short {\n    display: inline;\n  }');
    expect(backLink.querySelector('.chq-detail-back-short')?.textContent).toBe('Triage');

    // docs/design/Chautauqua Submissions.dc.html:362
    // `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.2">Docs That Answer Back: Retrieval-Grounded Documentation Sites</h1>`
    verbatimLine(362, L362);
    const h1 = screen.getByRole('heading', { name: 'Docs That Answer Back: Retrieval-Grounded Documentation Sites' });
    expect(backLink.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // docs/design/Chautauqua Submissions.dc.html:363
    // `        <span style="font-size:13px; color:#565A4B">Dana Whitmore · Fieldnote Docs</span>`
    verbatimLine(363, L363);
    const byline = screen.getByText('Dana Whitmore · Fieldnote Docs');
    expect(h1.compareDocumentPosition(byline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // docs/design/Chautauqua Submissions.dc.html:367
    // `        <p style="margin:0; font-size:15px; line-height:1.65; color:#3F4237">A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it doesn't know, and costs under $50 a month to run.</p>`
    verbatimLine(367, L367);
    const abstract = screen.getByText(/A 10-minute tour of turning a static docs site/);
    expect(byline.compareDocumentPosition(abstract) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // CLOSED (commit 023e1257, DEC-878 wave-16 amendment): the frame draws
    // the abstract paragraph with NO visible preceding heading. The real
    // page's 'Abstract' H2 stays in the DOM/accessibility tree (jsdom
    // applies no @media, so getByRole still finds it) but now also carries
    // chq-detail-section-title-frameless -- a VISUAL-ONLY stand-down, not a
    // capability removal (DEC-919 wave-98's receipt is satisfied by
    // construction: the heading keeps its text, level, and DOM order).
    const abstractHeading = screen.getByRole('heading', { name: 'Abstract' });
    expect(abstractHeading).toBeInTheDocument();
    expect(abstractHeading.className).toContain('chq-detail-section-title-frameless');

    // Source-scan pin (phoneRule idiom, copied from
    // app/src/pages/submissions/detail-390-headings.test.ts): the frameless
    // class rule lives ONLY inside detail.css's terminal max-width:700px
    // block, and its body is the house visually-hidden clip recipe, never
    // display:none -- so desktop stays byte-identical outside that block.
    const detailCssPath = join(REPO_ROOT, 'app', 'src', 'pages', 'submissions', 'detail.css');
    const detailCss = readFileSync(detailCssPath, 'utf-8');
    const phoneOpener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
    let phoneBody = '';
    let opener: RegExpExecArray | null;
    while ((opener = phoneOpener.exec(detailCss)) !== null) {
      let depth = 1;
      let i = opener.index + opener[0].length;
      const start = i;
      while (i < detailCss.length && depth > 0) {
        if (detailCss[i] === '{') depth += 1;
        else if (detailCss[i] === '}') depth -= 1;
        i += 1;
      }
      phoneBody += detailCss.slice(start, i - 1);
    }
    const framelessRule = phoneBody.match(/\.chq-detail-section-title-frameless\s*\{([^}]*)\}/);
    expect(framelessRule).not.toBeNull();
    expect(framelessRule![1]).toMatch(/clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
    expect(framelessRule![1]).not.toMatch(/display:\s*none/);

    // docs/design/Chautauqua Submissions.dc.html:375
    // `          <span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Reviews · 3 of 3 in</span>`
    verbatimLine(375, L375);
    const reviewsHeading = screen.getByRole('heading', { name: /Reviews/ });
    expect(reviewsHeading.textContent).toBe('Reviews · 0 of 3 in');
    expect(abstract.compareDocumentPosition(reviewsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Frame :468-486 "CFP form · 390".
  it('frame :468 CFP form -- RESOLVED (task v12m-w21-l): back link, H1, field-list rows (Edit pill + drag handle), the year-less "16 Aug" meta line, and the fixed footer (Save the form + Preview) all render in the frame\'s own order and text; each field row\'s Delete button stays in the DOM (jsdom applies no stylesheet) but is CSS-hidden at 390, re-lined into FieldModal\'s own "Delete this question" action -- a DOM fact, not a screen divergence', async () => {
    const EVENT_ID = 'evt-forms-frame-468';
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: {
        id: 'form-1',
        eventId: EVENT_ID,
        intro: '',
        openDate: null,
        closeDate: 1755302400000, // 2025-08-16
        tracks: [],
        fields: [{ id: 'f1', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true }],
      },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 47 }),
    });

    render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'CFP form' })).toBeInTheDocument();
    });

    // docs/design/Chautauqua Submissions.dc.html:468
    // `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(468, L468);
    expect(screen.getByRole('heading', { name: 'CFP form' })).toBeInTheDocument();

    // docs/design/Chautauqua Submissions.dc.html:470
    // `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Submissions</a>`
    verbatimLine(470, L470);
    const backLink = screen.getByRole('link', { name: /Submissions/ });
    expect(backLink.textContent?.trim()).toBe('‹ Submissions');

    // docs/design/Chautauqua Submissions.dc.html:471
    // `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">CFP form</h1>`
    verbatimLine(471, L471);
    const h1 = screen.getByRole('heading', { name: 'CFP form' });
    expect(backLink.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // docs/design/Chautauqua Submissions.dc.html:472
    // `        <span style="font-size:13px; color:#565A4B">Closes 16 Aug · 47 received</span>`
    verbatimLine(472, L472);
    const meta = await screen.findByText('Closes 16 Aug · 47 received');
    expect(h1.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // CLOSED (commit 3886e33d, DEC-650 wave-16; retired here under DEC-967
    // wave-20/21 with the tree evidence quoted inline): the head meta now
    // MATCHES the frame's year-less date. app/src/pages/forms/FormsPage.tsx
    // composes its phone meta line from `formatDateOnlyNoYear(form.closeDate)`
    // (app/src/lib/dates.ts), not the year-bearing formatDateOnly this row
    // used to name. The note sits BELOW the assertions for the same
    // expect-proximity reason as the :149 row above.
    expect(screen.queryByText('Closes 16 Aug 2025 · 47 received')).not.toBeInTheDocument();

    // docs/design/Chautauqua Submissions.dc.html:476
    // `            <span style="font-size:16px; color:#8E8A7A">⋮⋮</span>`
    verbatimLine(476, L476);
    expect(screen.getByRole('button', { name: /Reorder Title/ })).toHaveTextContent('⋮⋮');

    // docs/design/Chautauqua Submissions.dc.html:481
    // `            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Edit</span>`
    verbatimLine(481, L481);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    // The row's own 'Delete' button stays in the DOM -- jsdom applies no
    // stylesheet -- but forms.css's phone block hides it
    // (.chq-forms-field-row-delete { display:none }), re-lined into
    // FieldModal's own far-left 'Delete this question' action reached via
    // this same visible Edit control. A DOM element, not a drawn control.
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toHaveClass('chq-forms-field-row-delete');

    // docs/design/Chautauqua Submissions.dc.html:484
    // `        <span style="display:flex; align-items:center; justify-content:center; margin-top:14px; border:1px dashed #BAB6A6; border-radius:6px; min-height:46px; font-size:13px; font-weight:700; color:#4E5C31">Add a question</span></div>`
    verbatimLine(484, L484);
    expect(screen.getAllByRole('button', { name: 'Add a question' }).length).toBeGreaterThan(0);

    // docs/design/Chautauqua Submissions.dc.html:486
    // `        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save the form</span>`
    verbatimLine(486, L486);
    const footerSave = screen.getAllByRole('button', { name: 'Save the form' });
    expect(footerSave.length).toBe(1);
    const footerPreview = screen.getAllByRole('link', { name: 'Preview' });
    expect(footerPreview.length).toBeGreaterThan(0);
    expect(footerSave[0]!.compareDocumentPosition(footerPreview[footerPreview.length - 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
