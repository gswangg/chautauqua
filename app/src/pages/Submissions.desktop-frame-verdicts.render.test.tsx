// w23-f (DEC-976 wave-23 amendment): the Submissions cluster's per-frame
// DESKTOP (1600) render verdict ledger. Sibling to
// Submissions.frame-verdicts.render.test.tsx (the 390 half, three frames)
// -- this file owns the FIVE remaining desktop/modal frames in
// docs/design/Chautauqua Submissions.dc.html that split across two
// components: the list states via Submissions.tsx (SubmissionsTable), and
// the CFP form builder via forms/FormsPage.tsx (the ADMIN builder -- NOT
// the public SSR CFP; same disambiguation the phone file's :468 row already
// records). Frames :28, :187, :495 already carry citations elsewhere and
// are NOT this file's job.
//
// STRICTLY MEASUREMENT ONLY: desktop is frozen by the mandate. This file
// moves no desktop byte and edits no component/stylesheet -- it renders
// the real route, verdicts what the tree actually produces, and files
// divergences in prose. Modelled EXACTLY on
// Speakers.desktop-frame-verdicts.render.test.tsx: same verbatimLine
// helper, same beforeEach/afterEach console guard, same mockApi usage.
//
// jsdom applies no stylesheet (no @media, no computed geometry), so every
// assertion here is DOM structure/order/text -- never a computed style and
// never a re-read of the design pack as its own proof (DEC-976/DEC-967).
// Every DOM lookup runs BEFORE its citation comment; the citation is
// `path:line` + PROSE naming the drawn control in backticks (never a
// verbatim backtick-quoted COPY of the whole source line, which is
// app/src/pages/Submissions.frame-verdicts.render.test.tsx's OLDER shape)
// -- matching the Speakers desktop file's own EXPECT_PROXIMITY_LINES
// discipline (DEC-976 wave-116), and satisfying app/src/frame-citation.
// scan.test.ts's own DESKTOP_UNRECEIPTED_CLAIM_CEILING (a backtick quote
// in the same comment, plus a real expect( within 6 lines beneath it).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsPage } from './Submissions';
import { FormsPage } from './forms/FormsPage';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests, resetInitialStoredIdForTests } from '../lib/useCurrentEvent';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Submissions.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  // useCurrentEvent.ts's own test-only seam (see Submissions.frame-verdicts.
  // render.test.tsx's identical beforeEach note): reset the module-level
  // navigation-context cache so each it() in this file reads its OWN
  // localStorage event id, not a prior test's frozen snapshot.
  resetInitialStoredIdForTests();
  resetEventsCacheForTests();
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('v12 Submissions DESKTOP (1600) frames: per-frame render verdict receipts (w23-f, DEC-976 wave-23 amendment)', () => {
  // -------------------------------------------------------------------
  // Frame :531 "Save this view" (Modal, reached from the list toolbar)
  // -------------------------------------------------------------------
  describe('frame :531 "Save this view" (SaveViewDialog, reached from SubmissionsTable\'s ViewTabs)', () => {
    const EVENT_ID = 'evt-submissions-desktop-saveview';

    function renderList() {
      window.localStorage.setItem('chq.currentEventId', EVENT_ID);
      mockApi({
        'GET /api/v1/me': { userId: 'u-self', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-ai', name: 'AI Engineering', color: '#4f46e5' }]),
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { fields: [], openDate: null },
        [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([]),
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
          { total: 1 },
        ),
      });
      return render(
        <MemoryRouter>
          <SubmissionsPage />
        </MemoryRouter>,
      );
    }

    it('MATCHES: the dialog title/subtitle/Name-it/Share/actions all render, and the subtitle states the LIVE filter state (Pending / AI Engineering / newest first) the frame itself draws', async () => {
      renderList();
      await screen.findByRole('heading', { name: 'Submissions' });
      await waitFor(() => expect(screen.getByText('A Talk About Testing')).toBeInTheDocument());

      // Drive the SAME filter state the frame's own subtitle names, through
      // the real controls -- not a fabricated filters object.
      fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
      fireEvent.change(screen.getByRole('combobox', { name: 'Filter by track' }), { target: { value: 'trk-ai' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save current as view' }));

      const dialogTitle = screen.getByRole('heading', { name: 'Save this view', level: 2 });
      // docs/design/Chautauqua Submissions.dc.html:537 opens the dialog
      // titled `Save this view`, in a 440px card (the mock's narrower
      // one-off measure, per ViewTabs.tsx's own chq-submissions-save-view-
      // modal comment).
      verbatimLine(537, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Save this view</span>');
      expect(dialogTitle).toBeInTheDocument();

      const subtitle = document.querySelector('.chq-modal-sub')?.textContent;
      // docs/design/Chautauqua Submissions.dc.html:538 states the dialog's
      // subtitle as `Pending · AI Engineering · newest first` -- the exact
      // sentence summarizeFilters() (ViewTabs.tsx) produces once Pending +
      // AI Engineering are the active filters.
      verbatimLine(538, '          <span style="font-size:13px; color:#565A4B">Pending · AI Engineering · newest first</span>');
      expect(subtitle).toBe('Pending · AI Engineering · newest first');

      // docs/design/Chautauqua Submissions.dc.html:544 draws `Name it`
      // above the view-name field.
      verbatimLine(544, '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Name it</span>');
      expect(screen.getByLabelText('Name it')).toBeInTheDocument();

      // docs/design/Chautauqua Submissions.dc.html:548 -- the
      // `Share it with the other organisers` checkbox label.
      verbatimLine(548, '          Share it with the other organisers');
      const shareCheckbox = screen.getByRole('checkbox', { name: 'Share it with the other organisers' });
      expect(shareCheckbox).not.toBeChecked();

      // docs/design/Chautauqua Submissions.dc.html:551-552 -- `Save the
      // view` then `Cancel`, both rendered, in that order.
      verbatimLine(551, '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Save the view</span>');
      const saveBtn = screen.getByRole('button', { name: 'Save the view' });
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      expect(saveBtn.compareDocumentPosition(cancelBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------
  // Frame :561 "Submissions · before the CFP opens" (1600, fresh empty)
  // -------------------------------------------------------------------
  describe('frame :561 "Submissions · before the CFP opens" (fresh empty state, SubmissionsTable)', () => {
    const EVENT_ID = 'evt-submissions-desktop-fresh';
    const FUTURE_OPEN = Date.UTC(2027, 1, 1); // 1 Feb 2027

    function renderFresh() {
      window.localStorage.setItem('chq.currentEventId', EVENT_ID);
      mockApi({
        'GET /api/v1/me': { userId: 'u-self', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { fields: [], openDate: FUTURE_OPEN },
        [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 0 }),
      });
      return render(
        <MemoryRouter>
          <SubmissionsPage />
        </MemoryRouter>,
      );
    }

    it('MATCHES: "No submissions yet" with the CFP-open reason and the frame\'s two actions (Open the form now / Add one by hand)', async () => {
      renderFresh();
      const h1 = await screen.findByRole('heading', { name: 'Submissions' });
      // docs/design/Chautauqua Submissions.dc.html:587 draws the H1
      // `Submissions` above the fresh-empty block.
      verbatimLine(587, '          <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:36px; font-weight:700; letter-spacing:-0.04em; line-height:1">Submissions</h1>');
      expect(h1).toBeInTheDocument();

      const what = await screen.findByText('No submissions yet');
      // docs/design/Chautauqua Submissions.dc.html:591 -- the fresh-empty
      // headline `No submissions yet`, verbatim.
      verbatimLine(591, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.035em; line-height:1.2">No submissions yet</span>');
      expect(what).toHaveClass('chq-empty-what');

      // docs/design/Chautauqua Submissions.dc.html:592 -- the reason line
      // `The call for papers opens on 1 February...` names the CFP's real
      // open date; formatDateOnly renders "1 Feb 2027", not the sample.
      verbatimLine(592, '          <span style="font-size:16px; line-height:1.65; color:#3F4237; max-width:52ch">The call for papers opens on 1 February. Anything submitted after that appears here for triage.</span>');
      const reason = screen.getByText(/The call for papers opens on/);
      expect(reason.textContent).toBe('The call for papers opens on 1 Feb 2027. Anything submitted after that appears here for triage.');

      // docs/design/Chautauqua Submissions.dc.html:594 -- the primary
      // action `Open the form now`.
      verbatimLine(594, '            <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Open the form now</span>');
      const primary = screen.getByRole('link', { name: 'Open the form now' });
      expect(primary).toHaveAttribute('href', '/submissions/forms');

      // docs/design/Chautauqua Submissions.dc.html:595 -- the secondary
      // `Add one by hand ›`, opening the New Submission modal rather than
      // navigating (an onClick action, per EmptyStateSecondary's duality).
      verbatimLine(595, '            <a href="#" style="font-size:14px; font-weight:700">Add one by hand ›</a>');
      const secondary = screen.getByRole('button', { name: 'Add one by hand ›' });
      expect(what.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(primary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // The frame draws NO filter chrome above this block (ViewTabs/
      // FilterBar) -- an unfiltered fresh collection has nothing to filter.
      expect(screen.queryByRole('group', { name: 'Saved views' })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  // Frame :605 "Submissions · triage queue clear" (1600, settled empty)
  // -------------------------------------------------------------------
  describe('frame :605 "Submissions · triage queue clear" (triage-cleared empty state, SubmissionsTable)', () => {
    const EVENT_ID = 'evt-submissions-desktop-cleared';

    function renderCleared() {
      window.localStorage.setItem('chq.currentEventId', EVENT_ID);
      // The pendingTotal/allTotal counts and the main list all read the
      // SAME "GET .../submissions" route (mockApi keys by path only, query
      // stripped) -- ordered by the component's own effect-commit order
      // (SubmissionsTable.tsx): useCachedList's main-list fetch runs first,
      // then the pendingTotal fetch, then the allTotal fetch, both declared
      // in the same later effect. A stateful counter hands each caller its
      // own real response instead of one shared fabricated number.
      let call = 0;
      const responses = [
        // main list, unfiltered on mount -- non-empty so the toolbar chrome
        // (ViewTabs/FilterBar) is already on screen for the click below;
        // the frame itself draws that chrome above the triage-cleared card.
        listEnvelope(
          [
            {
              id: 'sub-accepted',
              ref: 'S-009',
              title: 'Accepted Talk',
              status: 'accepted',
              contentStatus: 'pending',
              speakers: [{ contactId: 'c9', name: 'Robin Vale' }],
              trackIds: [],
              submittedAt: 1700000000000,
              createdAt: 1700000000000,
            },
          ],
          { total: 47 },
        ),
        listEnvelope([], { total: 0 }), // pendingTotal: status=pending&perPage=1
        listEnvelope([], { total: 47 }), // allTotal: perPage=1
      ];
      mockApi({
        'GET /api/v1/me': { userId: 'u-self', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { fields: [], openDate: null },
        [`GET /api/v1/events/${EVENT_ID}/views`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: () => responses[Math.min(call++, responses.length - 1)],
      });
      return render(
        <MemoryRouter>
          <SubmissionsPage />
        </MemoryRouter>,
      );
    }

    it('MATCHES (narrowed): "Nothing left to triage" renders once the Pending status facet is applied and the event carries submissions -- the chrome (ViewTabs/FilterBar) stays visible above it, matching the frame; the reason line is narrower than the frame\'s (no "Twelve are still waiting on content" clause)', async () => {
      renderCleared();
      const h1 = await screen.findByRole('heading', { name: 'Submissions' });
      // docs/design/Chautauqua Submissions.dc.html:631 -- the same H1
      // `Submissions` heading as the fresh-empty frame above.
      verbatimLine(631, '          <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:36px; font-weight:700; letter-spacing:-0.04em; line-height:1">Submissions</h1>');
      expect(h1).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Accepted Talk')).toBeInTheDocument());

      // Drive the Pending status filter through the real control -- the
      // triageCleared branch requires status===['pending'] exactly
      // (SubmissionsTable.tsx), matching the frame's own "Needs triage · 0"
      // active chip.
      fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

      const what = await screen.findByText('Nothing left to triage');
      // docs/design/Chautauqua Submissions.dc.html:642 -- the
      // triage-cleared headline `Nothing left to triage`, verbatim.
      verbatimLine(642, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.035em; line-height:1.2">Nothing left to triage</span>');
      expect(what).toHaveClass('chq-empty-what');

      // docs/design/Chautauqua Submissions.dc.html:643 draws a TWO-sentence
      // reason, `All 47 submissions have a decision. Twelve are still
      // waiting...`; the tree states only the first sentence.
      verbatimLine(643, '          <span style="font-size:16px; line-height:1.65; color:#3F4237; max-width:52ch">All 47 submissions have a decision. Twelve are still waiting on content, if you want the next thing.</span>');
      const reason = screen.getByText(/have a decision/);
      expect(reason.textContent).toBe('All 47 submissions have a decision.');
      expect(screen.queryByText(/Twelve are still waiting/)).not.toBeInTheDocument();

      // The chrome (ViewTabs/FilterBar) stays visible ABOVE the message --
      // matching the frame's own header pill strip, not hidden the way the
      // 'fresh' state above hides it. showChrome derives this from
      // describeActiveFacet still reporting the status facet as active even
      // while triageCleared's own branch renders.
      expect(screen.getByRole('group', { name: 'Saved views' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();

      // docs/design/Chautauqua Submissions.dc.html:645 -- the one action,
      // `Go to content ›`.
      verbatimLine(645, '            <a href="#" style="font-size:14px; font-weight:700">Go to content ›</a>');
      const goToContent = screen.getByRole('link', { name: 'Go to content ›' });
      expect(what.compareDocumentPosition(goToContent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // No escape control (DEC-370/EmptyState's own construction rule): the
      // triage-cleared state is a success report, not a filter failure.
      expect(screen.queryByRole('button', { name: /Clear filter/ })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  // Frame :399 "CFP form builder · /submissions/forms" (1600, FormsPage)
  // -------------------------------------------------------------------
  describe('frame :399 "CFP form builder · /submissions/forms" (FormsPage, the admin builder)', () => {
    const EVENT_ID = 'evt-forms-desktop-builder';

    function renderBuilder() {
      window.localStorage.setItem('chq.currentEventId', EVENT_ID);
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
        [`GET /api/v1/events/${EVENT_ID}/forms`]: {
          id: 'form-1',
          eventId: EVENT_ID,
          intro: '',
          openDate: null,
          closeDate: 1755302400000, // 16 Aug 2025
          tracks: [],
          fields: [{ id: 'f1', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true }],
        },
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 47 }),
      });
      return render(
        <MemoryRouter>
          <FormsPage />
        </MemoryRouter>,
      );
    }

    it('MATCHES: back link -> H1 -> Preview/Save order, and the Opens/Closes/Received strip renders its three labelled cells', async () => {
      renderBuilder();
      const h1 = await screen.findByRole('heading', { name: 'CFP form' });

      const backLink = screen.getByRole('link', { name: /Submissions/ });
      // docs/design/Chautauqua Submissions.dc.html:405 -- the desktop
      // builder's own back link, `‹ Submissions`.
      verbatimLine(405, '          <a href="#" style="font-size:13px; font-weight:700">‹ Submissions</a>');
      expect(backLink.textContent?.trim()).toBe('‹ Submissions');

      // docs/design/Chautauqua Submissions.dc.html:406 -- the H1 `CFP form`
      // follows the back link, matching the frame's own head-band order.
      verbatimLine(406, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:28px; font-weight:700; letter-spacing:-0.04em; line-height:1">CFP form</span>');
      expect(backLink.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // jsdom applies no @media -- both the desktop header Preview link and
      // the phone-only footer Preview link sit in the DOM; the header's is
      // the first in document order.
      const previewLink = screen.getAllByRole('link', { name: 'Preview' })[0]!;
      // docs/design/Chautauqua Submissions.dc.html:409 -- `Preview`.
      verbatimLine(409, '          <a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17; background:#EFEBDF">Preview</a>');
      expect(previewLink).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', { name: 'Save' });
      // docs/design/Chautauqua Submissions.dc.html:410 -- `Save` follows
      // Preview in the header actions.
      verbatimLine(410, '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:10px 15px; font-size:13px; font-weight:700">Save</span>');
      expect(previewLink.compareDocumentPosition(saveBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // docs/design/Chautauqua Submissions.dc.html:417/421/425 -- the
      // `Opens`/`Closes`/`Received` strip's three cell labels, in that order.
      verbatimLine(417, '            <div style="font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#565A4B">Opens</div>');
      verbatimLine(421, '            <div style="font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#565A4B">Closes</div>');
      verbatimLine(425, '            <div style="font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#565A4B">Received</div>');
      expect(screen.getByText('Opens')).toBeInTheDocument();
      expect(screen.getByText('Closes')).toBeInTheDocument();
      expect(screen.getByText('Received')).toBeInTheDocument();
      const receivedValue = await screen.findByText('47 submissions');
      expect(receivedValue).toBeInTheDocument();
    });

    it('MATCHES: the Fields section header ("Fields" + Add a question) and a field row\'s own anatomy (drag handle "⋮⋮", then label, then Edit/Delete) render in the frame\'s order', async () => {
      renderBuilder();
      await screen.findByRole('heading', { name: 'CFP form' });

      const fieldsHeading = screen.getByRole('heading', { name: 'Fields', level: 2 });
      // docs/design/Chautauqua Submissions.dc.html:432 -- the `Fields`
      // section label, drawn as a small caps caption in the frame; the
      // tree renders it as a real <h2>, a stronger DOM fact than the
      // frame's plain span but the SAME text and position.
      verbatimLine(432, '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Fields</span>');
      expect(fieldsHeading).toBeInTheDocument();

      const addQuestion = screen.getAllByRole('button', { name: 'Add a question' })[0]!;
      // docs/design/Chautauqua Submissions.dc.html:433 draws `Add a
      // question` right-flushed beside the Fields label; the tree's
      // desktop control is a <button>, not an <a> -- same text/position.
      verbatimLine(433, '            <a href="#" style="font-size:13px; font-weight:700">Add a question</a>');
      expect(fieldsHeading.compareDocumentPosition(addQuestion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      const dragHandle = screen.getByRole('button', { name: /Reorder Title/ });
      // docs/design/Chautauqua Submissions.dc.html:437 -- the row's drag
      // handle glyph `⋮⋮`, the first element in the row's grid.
      verbatimLine(437, '              <span style="font-size:14px; color:#8E8A7A">⋮⋮</span>');
      expect(dragHandle).toHaveTextContent('⋮⋮');

      const editBtn = within(dragHandle.closest('[role="listitem"]') as HTMLElement).getByRole('button', { name: 'Edit' });
      const deleteBtn = within(dragHandle.closest('[role="listitem"]') as HTMLElement).getByRole('button', { name: 'Delete' });
      // docs/design/Chautauqua Submissions.dc.html:445/446 -- `Edit` then
      // `Delete`, the row's trailing action pair, in that order.
      verbatimLine(445, '                <a href="#">Edit</a>');
      expect(dragHandle.compareDocumentPosition(editBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(editBtn.compareDocumentPosition(deleteBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('MATCHES: the footer Public link row (label, value, Copy) renders below the field list', async () => {
      renderBuilder();
      await screen.findByRole('heading', { name: 'CFP form' });

      const label = screen.getByText('Public link');
      // docs/design/Chautauqua Submissions.dc.html:453 -- `Public link`.
      verbatimLine(453, '          <span style="font-size:13px; color:#565A4B">Public link</span>');
      expect(label).toBeInTheDocument();

      const copyBtn = screen.getByRole('button', { name: 'Copy' });
      // docs/design/Chautauqua Submissions.dc.html:455 -- `Copy` is the
      // row's trailing control; the frame draws an anchor, the tree a
      // <button> (copies to clipboard rather than navigating) -- same text.
      verbatimLine(455, '          <a href="#" style="font-size:13px; font-weight:700">Copy</a>');
      expect(label.compareDocumentPosition(copyBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------
  // Frame :655 "CFP form · edit a question" (Modal, FieldModal via FormsPage)
  // -------------------------------------------------------------------
  describe('frame :655 "CFP form · edit a question" (FieldModal edit, reached from FormsPage\'s field row)', () => {
    const EVENT_ID = 'evt-forms-desktop-editfield';

    function renderEdit() {
      window.localStorage.setItem('chq.currentEventId', EVENT_ID);
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
        [`GET /api/v1/events/${EVENT_ID}/forms`]: {
          id: 'form-1',
          eventId: EVENT_ID,
          intro: '',
          openDate: null,
          closeDate: 1755302400000,
          tracks: [],
          fields: [
            {
              id: 'f-format',
              section: 'session',
              kind: 'dropdown',
              label: 'Audience level',
              helpText: 'Beginner, intermediate or advanced',
              required: false,
              position: 0,
              locked: false,
              options: ['Beginner', 'Intermediate', 'Advanced'],
            },
          ],
        },
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 47 }),
      });
      return render(
        <MemoryRouter>
          <FormsPage />
        </MemoryRouter>,
      );
    }

    it('MATCHES: opening the real field row\'s Edit control lands on FieldModal titled "Edit a question" with the blast-radius subtitle naming the real answered count', async () => {
      renderEdit();
      await screen.findByRole('heading', { name: 'CFP form' });

      // Enter through the REAL interaction: FieldList's own Edit control,
      // not a directly-mounted FieldModal.
      fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

      const title = screen.getByRole('heading', { name: 'Edit a question', level: 2 });
      // docs/design/Chautauqua Submissions.dc.html:662 -- the modal's own
      // `Edit a question` title, distinct from the "Add a question" case.
      verbatimLine(662, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:22px; font-weight:700; letter-spacing:-0.035em; line-height:1.1">Edit a question</span>');
      expect(title).toBeInTheDocument();

      const subtitle = document.querySelector('.chq-modal-sub')?.textContent;
      // docs/design/Chautauqua Submissions.dc.html:663 -- the frame's
      // sample `47 people have already answered this form`; the tree reads
      // the SAME real received.total into the identical sentence.
      verbatimLine(663, '          <span style="font-size:13px; color:#565A4B">47 people have already answered this form</span>');
      expect(subtitle).toBe('47 people have already answered this form — editing a live question changes what those answers mean');
    });

    it('MATCHES: the conditional-visibility Field/Is/Value row renders the real trigger/op/value the field already has, and states the required-guard sentence', async () => {
      renderEdit();
      await screen.findByRole('heading', { name: 'CFP form' });
      fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      await screen.findByRole('heading', { name: 'Edit a question' });

      const fieldTrigger = screen.getByLabelText('Field', { selector: 'select' });
      // docs/design/Chautauqua Submissions.dc.html:704 -- the `Field`/`Is`/
      // `Value` row shares one 3-column grid track; the tree's own FormRow
      // triple renders real <select> controls there instead.
      verbatimLine(704, '          <div style="display:grid; grid-template-columns:1fr 120px 1fr; gap:10px; align-items:end">');
      // The field being edited has no rule of its own -- "Always visible".
      expect(fieldTrigger).toHaveValue('');

      const requiredGuard = screen.getByText('Leave it off and the question always shows.');
      // docs/design/Chautauqua Submissions.dc.html:701-702 -- `Only show
      // this question when…` then the off-case caption underneath it,
      // always present (not conditional on a trigger being set, DEC-650).
      verbatimLine(701, '            <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Only show this question when…</span>');
      expect(requiredGuard).toBeInTheDocument();
    });

    it('MATCHES: the footer carries Delete this question (far left) then Cancel/Save the question (right-flushed), in that order', async () => {
      renderEdit();
      await screen.findByRole('heading', { name: 'CFP form' });
      fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      await screen.findByRole('heading', { name: 'Edit a question' });

      const deleteBtn = screen.getByRole('button', { name: 'Delete this question' });
      // docs/design/Chautauqua Submissions.dc.html:722 -- `Delete this
      // question` sits far left in the footer; the tree renders it as a
      // real destructive-tertiary button (not the frame's bare anchor),
      // same position and text.
      verbatimLine(722, '        <a href="#" style="font-size:13px; font-weight:700; color:#565A4B">Delete this question</a>');
      expect(deleteBtn).toBeInTheDocument();
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      const saveBtn = screen.getByRole('button', { name: 'Save the question' });
      expect(deleteBtn.compareDocumentPosition(cancelBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(cancelBtn.compareDocumentPosition(saveBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
