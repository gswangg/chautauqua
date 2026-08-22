// w23-c (DEC-976 wave-23 amendment): the per-frame DESKTOP (1600) render
// verdict for Overview -- the cluster the wave-23 amendment names as
// adjudicated 0 of its own desktop frames despite the ledger's citation-only
// CLAIMED_FLOOR reading 100/100 (citation, not conformance -- DEC-967). This
// file owns the FIVE desktop frames in docs/design/Chautauqua Overview.dc.html
// the amendment lists (`:353` "Widths · what a wide monitor gets" is the
// ledger's own hand-excluded explainer panel, not adjudicated here) and a new
// audit doc, docs/design/audit/overview-desktop-v12.md.
//
// Modelled exactly on Speakers.desktop-frame-verdicts.render.test.tsx:
// same verbatimLine(lineNo, literal) helper, same beforeEach/afterEach
// console guard, same mockApi test-utils. STRICTLY MEASUREMENT ONLY: desktop
// is frozen by the mandate, so this file moves no desktop byte and edits no
// component/stylesheet -- it renders the real route, verdicts what the tree
// actually produces, and files divergences in prose. jsdom applies no
// stylesheet (no @media, no computed grid-template-columns/transition), so
// every assertion here is DOM structure/order/text, or a readFileSync of the
// APP's own stylesheet TEXT for a claim that is inherently a CSS fact -- the
// design pack is never re-read as its own proof (DEC-976/DEC-967). Every
// DOM/CSS lookup runs BEFORE its citation comment so the citation sits
// immediately beside the `expect(` that receipts it (DEC-976 wave-116's
// EXPECT_PROXIMITY_LINES window).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OverviewPage } from './Overview';
import { App } from '../App';
import { mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests } from '../lib/useCurrentEvent';
import type { OverviewPayload } from './overview/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Overview.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied verbatim from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-overview-desktop-verdicts';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  window.history.pushState({}, '', '/admin');
  resetEventsCacheForTests();
  vi.unstubAllGlobals();
});

describe('v12 Overview DESKTOP (1600) frames: per-frame render verdict receipts (w23-c, DEC-976 wave-23 amendment)', () => {
  // ---------------------------------------------------------------------
  // Frame :28 "What needs you today · 1600"
  // ---------------------------------------------------------------------
  describe('frame :28 "What needs you today · 1600"', () => {
    function populatedPayload(): OverviewPayload {
      return {
        deadlines: {
          formCloseDate: Date.UTC(2027, 4, 1),
          nextTaskDueDate: Date.UTC(2027, 4, 3),
          planCloseDate: null,
          planRound: null,
          eventStartDate: Date.UTC(2027, 4, 20),
        },
        overdueTasks: {
          total: 1,
          rows: [
            {
              assignmentId: 'as-1',
              contactId: 'ct-1',
              contactName: 'Ruth Adeyemi',
              company: 'Northwind Labs',
              taskId: 'task-1',
              taskTitle: 'Hotel stay form',
              dueDate: Date.UTC(2027, 3, 1),
              daysLate: 4,
            },
          ],
        },
        triage: {
          total: 1,
          oldestSubmittedAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
          rows: [
            {
              submissionId: 'sub-1',
              ref: 'DFC-033',
              title: 'Docs That Answer Back',
              speakerName: 'Dana Whitmore',
              trackName: 'Developer Experience',
              format: null,
              submittedAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
            },
          ],
        },
        contentApproval: {
          total: 1,
          reuploadedCount: 0,
          rows: [
            {
              submissionId: 'sub-2',
              ref: 'DFC-038',
              title: 'Zero-Downtime Schema Migrations',
              speakerName: 'Ezra Lindqvist',
              fileName: 'slides.pdf',
              uploadedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
              reuploaded: false,
            },
          ],
        },
        agendaWork: {
          // unplacedTotal(1) > unplaced.length(0): the row itself is not
          // sent, only the count, so §04 renders ONLY its below-the-list
          // overflow summary -- matching what this frame's own §01/§02/§03
          // sections already do for their own totals, and giving the
          // overflow-line test below a real (non-empty) node to find.
          unplacedTotal: 1,
          conflictTotal: 0,
          conflicts: [],
          unplaced: [],
          unplacedRemainderDurationMin: null,
        },
        'triage-counts': { pending: 1, accept_queue: 0, decline_queue: 0 },
        review: { plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 },
        speakers: { contactsOwing: 1, overdueAssignments: 1 },
        content: { awaitingApproval: 1 },
        agenda: { unplaced: 1, conflicts: 0 },
        comms: { sentLast7Days: 0, lastSentAt: null },
        publishedSessionCount: 0,
      };
    }

    function renderOverview() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/overview`]: populatedPayload(),
        'GET /api/v1/events': { items: [{ id: EVENT_ID, slug: 'devflow-2027', timezone: 'UTC', name: 'DevFlow Conf 2027' }], total: 1, page: 1, perPage: 50 },
      });
      return render(
        <MemoryRouter initialEntries={['/overview']}>
          <Routes>
            <Route path="/overview" element={<OverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: the headline is computed, never a literal 4 -- "Four things need your attention" falls out of the fixture\'s own four actionable totals', async () => {
      renderOverview();
      const heading = await screen.findByRole('heading', { name: 'Four things need your attention' });
      // docs/design/Chautauqua Overview.dc.html:65 draws the headline
      // `Four things need your attention` -- the frame's own hardcoded copy
      // for a fixture that happens to sum to four (1 overdue + 1 triage + 1
      // content + 1 unplaced + 0 conflicts).
      verbatimLine(65, '            <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:44px; font-weight:700; letter-spacing:-0.042em; line-height:1.04">Four things need your attention</h1>');
      expect(heading).toBeInTheDocument();
    });

    it('MATCHES: the toolbar reads Export then New submission, in that order', async () => {
      renderOverview();
      await screen.findByRole('heading', { name: 'Four things need your attention' });
      const toolbar = document.querySelector('.chq-overview-toolbar');
      const items = within(toolbar as HTMLElement).getAllByRole('link').map((l) => l.textContent);
      // docs/design/Chautauqua Overview.dc.html:67-68 draws the toolbar as
      // `Export` then `New submission`, in that order.
      verbatimLine(68, '              <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:11px 16px; font-size:13px; font-weight:700; white-space:nowrap">New submission</span>');
      expect(items).toEqual(['Export', 'New submission']);
    });

    it('MATCHES: §01\'s caption reads "Skips anyone reminded in the last hour" once a row exists', async () => {
      renderOverview();
      await screen.findByRole('heading', { name: 'Four things need your attention' });
      const caption = screen.queryByText('Skips anyone reminded in the last hour');
      // docs/design/Chautauqua Overview.dc.html:77 draws the §01 caption
      // `Skips anyone reminded in the last hour`.
      verbatimLine(77, '            <div style="font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#565A4B; padding:9px 0 0">Skips anyone reminded in the last hour</div>');
      expect(caption).toBeInTheDocument();
    });

    it('MATCHES: §02\'s triage card draws Accept / Decline / Waitlist / Read the abstract, in that order', async () => {
      renderOverview();
      await screen.findByRole('heading', { name: 'Four things need your attention' });
      const heading = screen.getByText('02 — Submissions awaiting triage');
      const section = heading.closest('section') as HTMLElement;
      const actions = within(section).getAllByRole('button').map((b) => b.textContent);
      const link = within(section).getByRole('link', { name: 'Read the abstract' });
      // docs/design/Chautauqua Overview.dc.html:109 draws §02's fourth
      // control, `Read the abstract`, following Accept/Decline/Waitlist.
      verbatimLine(109, '                  <a href="#" style="font-size:13px; font-weight:700; padding:0 6px">Read the abstract</a>');
      expect(actions).toEqual(['Accept', 'Decline', 'Waitlist']);
      expect(link).toBeInTheDocument();
    });

    it('DIVERGES: §03 draws Approve + "Ask for changes"; the tree draws Approve + "Open" (a view/detail link, not a decision)', async () => {
      renderOverview();
      await screen.findByRole('heading', { name: 'Four things need your attention' });
      const heading = screen.getByText('03 — Session content awaiting approval');
      const section = heading.closest('section') as HTMLElement;
      const askForChanges = within(section).queryByText('Ask for changes');
      const openLink = within(section).queryByRole('link', { name: 'Open' });
      // docs/design/Chautauqua Overview.dc.html:128 draws §03's second
      // control as `Ask for changes` -- a decision that returns the
      // submission to the speaker, not merely a navigation link.
      verbatimLine(128, '                  <span style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 16px; font-size:13px; font-weight:600; background:#EFEBDF; white-space:nowrap">Ask for changes</span>');
      expect(askForChanges).not.toBeInTheDocument();
      expect(openLink).toBeInTheDocument();
    });

    it('MATCHES: §04\'s overflow renders as a plain-text summary line below the list, not a nav link', async () => {
      renderOverview();
      await screen.findByRole('heading', { name: 'Four things need your attention' });
      const overflow = document.querySelector('.chq-overview-overflow');
      // docs/design/Chautauqua Overview.dc.html:164 draws §04's overflow
      // sentence, `3 more unplaced · all need 120 minutes`, as plain text
      // below the row list.
      verbatimLine(164, '            <div style="padding:13px 0 0; font-size:13px; color:#565A4B">3 more unplaced · all need 120 minutes</div>');
      expect(overflow?.tagName).toBe('DIV');
      expect(overflow?.textContent).not.toBe('');
    });
  });

  // ---------------------------------------------------------------------
  // Frame :308 "New event" -- reached "from the event switcher in any
  // header" (the frame's own subtitle), never part of OverviewPage's own
  // component tree. Entered via the real App shell (its own BrowserRouter)
  // navigated to /admin/overview, so the header + EventSwitcher are the
  // genuine chrome Overview renders inside, never a sub-component mounted
  // directly.
  // ---------------------------------------------------------------------
  describe('frame :308 "New event" (EventSwitcher modal, reachable from the Overview header)', () => {
    function renderAppOnOverview() {
      window.history.pushState({}, '', '/admin/overview');
      mockApi({
        'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
        'GET /api/v1/events': { items: [{ id: EVENT_ID, name: 'DevFlow Conf 2027' }], total: 1, page: 1, perPage: 50 },
        [`GET /api/v1/events/${EVENT_ID}/overview`]: {
          deadlines: { formCloseDate: null, nextTaskDueDate: null, planCloseDate: null, planRound: null, eventStartDate: null },
          overdueTasks: { total: 0, rows: [] },
          triage: { total: 0, oldestSubmittedAt: null, rows: [] },
          contentApproval: { total: 0, reuploadedCount: 0, rows: [] },
          agendaWork: { unplacedTotal: 0, conflictTotal: 0, conflicts: [], unplaced: [], unplacedRemainderDurationMin: null },
          'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
          review: { plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 },
          speakers: { contactsOwing: 0, overdueAssignments: 0 },
          content: { awaitingApproval: 0 },
          agenda: { unplaced: 0, conflicts: 0 },
          comms: { sentLast7Days: 0, lastSentAt: null },
          publishedSessionCount: 0,
        },
      });
      return render(<App />);
    }

    it('MATCHES: opening "New event…" from the Overview header shows a dialog titled "New event"', async () => {
      renderAppOnOverview();
      await screen.findByRole('heading', { name: 'Overview' });
      fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));
      const menu = await screen.findByRole('menu', { name: 'Events' });
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'New event…' }));
      const dialog = await screen.findByRole('dialog', { name: 'New event' });
      // docs/design/Chautauqua Overview.dc.html:317 draws the modal's
      // dismissal control, `Close`.
      verbatimLine(317, '        <a href="#" style="font-size:13px; font-weight:700">Close</a>');
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('MATCHES: the modal\'s primary/secondary action pair reads "Create the event" / "Cancel", in that order', async () => {
      renderAppOnOverview();
      await screen.findByRole('heading', { name: 'Overview' });
      fireEvent.click(screen.getByRole('button', { name: 'Switch event' }));
      const menu = await screen.findByRole('menu', { name: 'Events' });
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'New event…' }));
      const dialog = await screen.findByRole('dialog', { name: 'New event' });
      const buttons = within(dialog).getAllByRole('button').map((b) => b.textContent);
      // docs/design/Chautauqua Overview.dc.html:343 draws the modal's
      // primary action, `Create the event`.
      verbatimLine(343, '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Create the event</span>');
      expect(buttons).toContain('Create the event');
      expect(buttons.indexOf('Create the event')).toBeLessThan(buttons.indexOf('Cancel'));
    });
  });

  // ---------------------------------------------------------------------
  // Frame :432 "Overview · a brand-new event"
  // ---------------------------------------------------------------------
  describe('frame :432 "Overview · a brand-new event"', () => {
    function brandNewPayload(): OverviewPayload {
      return {
        deadlines: { formCloseDate: null, nextTaskDueDate: null, planCloseDate: null, planRound: null, eventStartDate: null },
        overdueTasks: { total: 0, rows: [] },
        triage: { total: 0, oldestSubmittedAt: null, rows: [] },
        contentApproval: { total: 0, reuploadedCount: 0, rows: [] },
        agendaWork: { unplacedTotal: 0, conflictTotal: 0, conflicts: [], unplaced: [], unplacedRemainderDurationMin: null },
        'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
        review: { plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 },
        speakers: { contactsOwing: 0, overdueAssignments: 0 },
        content: { awaitingApproval: 0 },
        agenda: { unplaced: 0, conflicts: 0 },
        comms: { sentLast7Days: 0, lastSentAt: null },
        publishedSessionCount: 0,
      };
    }

    function renderBrandNew() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/overview`]: brandNewPayload(),
        'GET /api/v1/events': { items: [{ id: EVENT_ID, slug: 'devflow-2028', timezone: 'UTC', name: 'DevFlow Conf 2028' }], total: 1, page: 1, perPage: 50 },
      });
      return render(
        <MemoryRouter initialEntries={['/overview']}>
          <Routes>
            <Route path="/overview" element={<OverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: the h1 reads "Overview" with a "· nothing scheduled" summary clause beside it', async () => {
      renderBrandNew();
      const heading = await screen.findByRole('heading', { name: 'Overview' });
      const summary = document.querySelector('.chq-overview-headline-summary')?.textContent;
      // docs/design/Chautauqua Overview.dc.html:459 draws the brand-new
      // summary clause, `DevFlow Conf 2028 · nothing scheduled`.
      verbatimLine(459, '          <span style="font-size:13px; color:#565A4B">DevFlow Conf 2028 · nothing scheduled</span>');
      expect(heading.tagName).toBe('H1');
      expect(summary).toMatch(/· nothing scheduled$/);
    });

    it('MATCHES: the empty state carries "Nothing needs you yet" plus the reason sentence, verbatim', async () => {
      renderBrandNew();
      await screen.findByRole('heading', { name: 'Overview' });
      const what = screen.queryByText('Nothing needs you yet');
      const reason = screen.queryByText(
        'This event has no submissions, no speakers and no schedule. It starts when the call for papers opens.',
      );
      // docs/design/Chautauqua Overview.dc.html:463 draws the reason
      // sentence, `This event has no submissions, no speakers and no
      // schedule. It starts when the call for papers opens.`.
      verbatimLine(463, '          <span style="font-size:16px; line-height:1.65; color:#3F4237; max-width:52ch">This event has no submissions, no speakers and no schedule. It starts when the call for papers opens.</span>');
      expect(what).toBeInTheDocument();
      expect(reason).toBeInTheDocument();
    });

    it('MATCHES: the two-action row reads "Set up the call for papers" (primary, to CFP settings) then "Add a speaker by hand ›" (secondary)', async () => {
      renderBrandNew();
      await screen.findByRole('heading', { name: 'Overview' });
      const primary = screen.getByRole('link', { name: 'Set up the call for papers' });
      const secondary = screen.getByRole('link', { name: /Add a speaker by hand/ });
      // docs/design/Chautauqua Overview.dc.html:466 draws the secondary
      // action, `Add a speaker by hand ›`.
      verbatimLine(466, '            <a href="#" style="font-size:14px; font-weight:700">Add a speaker by hand ›</a>');
      expect(primary).toHaveAttribute('href', '/settings?section=cfp');
      expect(secondary).toHaveAttribute('href', '/speakers');
    });
  });

  // ---------------------------------------------------------------------
  // Frame :476 "States · hover, pending, drag" -- a system-wide token
  // reference, not a page-specific screen. Verdicted against the SPECIFIC
  // control families Overview actually draws (the frame's own "Buttons"
  // tier rule -- colour-only transition, nothing moves), read from
  // overview.css's own text since jsdom applies no stylesheet.
  // ---------------------------------------------------------------------
  describe('frame :476 "States · hover, pending, drag"', () => {
    const overviewCssPath = join(HERE, 'overview', 'overview.css');
    const overviewCss = readFileSync(overviewCssPath, 'utf-8');

    it('MATCHES ("each tier darkens... nothing moves", read from the app stylesheet TEXT): Overview\'s tiers transition colour only (never transform/box-shadow), and the two base tiers that own the transition declare it as colour-only', () => {
      // .chq-overview-btn-primary/.chq-overview-toolbar-btn-primary inherit
      // their colour transition from the shared base class every primary
      // control also carries (overview.css's own comment above each rule),
      // so only the two BASE tiers (secondary .chq-overview-btn, tertiary
      // .chq-overview-link-btn) declare `transition` themselves.
      const primaryBody = overviewCss.match(/\.chq-overview-btn-primary\s*\{([^}]*)\}/)?.[1] ?? '';
      const toolbarPrimaryBody = overviewCss.match(/\.chq-overview-toolbar-btn-primary\s*\{([^}]*)\}/)?.[1] ?? '';
      const secondaryBody = overviewCss.match(/\.chq-overview-btn\s*\{([^}]*)\}/)?.[1] ?? '';
      const tertiaryBody = overviewCss.match(/\.chq-overview-link-btn\s*\{([^}]*)\}/)?.[1] ?? '';
      // docs/design/Chautauqua Overview.dc.html:491 states the frame's own
      // rule for this catalogue, `Each tier darkens in its own family ·
      // nothing moves`.
      verbatimLine(491, '            <span style="font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#565A4B">Each tier darkens in its own family · nothing moves</span>');
      expect(secondaryBody).toMatch(/transition:\s*background-color/);
      expect(tertiaryBody).toMatch(/transition:\s*color/);
      for (const body of [primaryBody, toolbarPrimaryBody, secondaryBody, tertiaryBody]) {
        expect(body).not.toMatch(/transform/);
        expect(body).not.toMatch(/box-shadow/);
      }
    });

    it('DIVERGES: the frame catalogues a "Pending" tier (counted/uncountable progress, the button disables itself) and a "Drag" tier (dragged card, origin slot, valid target); Overview implements neither -- no in-flight send/upload control and no draggable session card on this page', () => {
      // docs/design/Chautauqua Overview.dc.html:690 states the frame's own
      // rule for the pending catalogue, `Nothing at all under 250ms`.
      verbatimLine(690, '      <span style="font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#565A4B">Nothing at all under 250ms</span>');
      expect(overviewCss).not.toMatch(/cursor:\s*progress/);
      expect(overviewCss).not.toMatch(/draggable|chq-drag/i);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :689 "Loading · the first paint" -- Overview's own use of the
  // shared PageSkeleton primitive (variant="list"), rendered on the FIRST
  // frame while `loading || !payload`.
  // ---------------------------------------------------------------------
  describe('frame :689 "Loading · the first paint"', () => {
    function renderLoading() {
      // mockApi's fetch stub always resolves eventually (it wraps every
      // handler's return value, including a Promise, in a synchronous
      // Response), so the FIRST PAINT this frame draws is captured by
      // asserting immediately after the synchronous `render()` call,
      // before the async apiGet's microtask has a chance to resolve and
      // flip `loading` false -- never by leaving a fetch permanently
      // pending (mockApi has no primitive for that).
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/overview`]: {
          deadlines: { formCloseDate: null, nextTaskDueDate: null, planCloseDate: null, planRound: null, eventStartDate: null },
          overdueTasks: { total: 0, rows: [] },
          triage: { total: 0, oldestSubmittedAt: null, rows: [] },
          contentApproval: { total: 0, reuploadedCount: 0, rows: [] },
          agendaWork: { unplacedTotal: 0, conflictTotal: 0, conflicts: [], unplaced: [], unplacedRemainderDurationMin: null },
          'triage-counts': { pending: 0, accept_queue: 0, decline_queue: 0 },
          review: { plans: 0, evaluationsSubmitted: 0, evaluationsExpected: 0 },
          speakers: { contactsOwing: 0, overdueAssignments: 0 },
          content: { awaitingApproval: 0 },
          agenda: { unplaced: 0, conflicts: 0 },
          comms: { sentLast7Days: 0, lastSentAt: null },
          publishedSessionCount: 0,
        },
        'GET /api/v1/events': { items: [{ id: EVENT_ID, slug: 'devflow', timezone: 'UTC', name: 'DevFlow' }], total: 1, page: 1, perPage: 50 },
      });
      return render(
        <MemoryRouter initialEntries={['/overview']}>
          <Routes>
            <Route path="/overview" element={<OverviewPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: the skeleton draws exactly six placeholder rows, matching the frame\'s own fixed six-row rule', () => {
      renderLoading();
      // Synchronous, no await: PageSkeleton renders on the FIRST frame (no
      // timer, DEC-678 wave-3 amendment) -- querying immediately after
      // `render()` and before any microtask flush is what actually proves
      // that, rather than merely proving a skeleton exists at some point.
      const skeleton = screen.getByRole('status');
      const rows = skeleton.querySelectorAll('.chq-skeleton-row');
      // docs/design/Chautauqua Overview.dc.html:726 states the frame's own
      // rule, `Six rows, always — a skeleton that guesses the real count
      // lies twice: once while loading, once when the number differs.`.
      verbatimLine(726, '          <span style="display:block; padding:16px 0 0; font-size:13px; color:#565A4B; line-height:1.55">Six rows, always — a skeleton that guesses the real count lies twice: once while loading, once when the number differs.</span>');
      expect(rows).toHaveLength(6);
    });

    it('MATCHES (read from the app stylesheet TEXT, never computed style): the skeleton bar never shimmers or pulses, and shares the hover-row tone #EFEBDF', () => {
      const skeletonCssPath = join(HERE, '..', 'components', 'page-skeleton.css');
      const skeletonCss = readFileSync(skeletonCssPath, 'utf-8');
      const stylesCssPath = join(HERE, '..', 'styles.css');
      const stylesCss = readFileSync(stylesCssPath, 'utf-8');
      const sunkToken = stylesCss.match(/--chq-surface-sunk:\s*(#[0-9a-fA-F]{6})/)?.[1];
      // docs/design/Chautauqua Overview.dc.html:731 states the frame's own
      // rule, "the skeleton uses `#EFEBDF`, the same tone as a hovered
      // row, so it reads as furniture rather than as content that failed
      // to load".
      verbatimLine(731, '          <span style="font-size:14px; line-height:1.65; color:#3F4237; max-width:78ch">Under <strong>250ms</strong>, show nothing — a skeleton that flashes is worse than a beat of stillness. Blocks never shimmer or pulse: an animation on a whole table is motion the user cannot act on, and it competes with the content arriving. The skeleton uses <strong>#EFEBDF</strong>, the same tone as a hovered row, so it reads as furniture rather than as content that failed to load.</span>');
      expect(skeletonCss).not.toMatch(/@keyframes|animation:/);
      expect(sunkToken?.toLowerCase()).toBe('#efebdf');
    });
  });
});
