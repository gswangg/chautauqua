// w23-e (DEC-976 wave-23 amendment): the per-frame DESKTOP (1600) render
// verdict for Comms, a Tier-0 wave-1 cluster whose PHONE rows already carry
// a real render receipt (app/src/pages/Comms.frame-verdicts.render.test.tsx,
// the three 390 frames) but whose desktop half has never been rendered
// against the pack at all. This file owns FOUR of the cluster's nine
// desktop frames in docs/design/Chautauqua Comms.dc.html:
//   :222 'Templates'
//   :360 'Compose · step 1 of 4'
//   :544 'Comms · nothing sent yet'
//   :589 'Comms · history'
// NOT this file's scope: :28 'Compose · step 3 of 4 · 1600', :453 'Compose ·
// step 4 of 4', :750 'Compose · send blocked', :686 'What each template
// renders', :712 'DevFlow Conf 2027' -- left for a later lane. :695
// `{{ e.name }}` is excluded from the population entirely by the ledger's
// template-interpolation pattern. Full verdict prose lives in
// docs/design/audit/comms-desktop-v12.md.
//
// STRICTLY MEASUREMENT ONLY: desktop is frozen by the mandate -- this file
// moves no desktop byte and edits no component/stylesheet. It renders the
// real route, verdicts what the tree actually produces, and files
// divergences in prose.
//
// Modelled exactly on Speakers.desktop-frame-verdicts.render.test.tsx: same
// verbatimLine(lineNo, literal) helper (copied verbatim below), same
// beforeEach/afterEach console-error guard, same mockApi/listEnvelope
// test-utils. Route entry follows Comms.frame-verdicts.render.test.tsx's own
// idiom: CommsPage's real route via MemoryRouter + `?tab=<tab>` (DEC-710),
// never a tab component mounted directly. jsdom applies no stylesheet (no
// @media, no computed geometry), so every assertion is DOM structure/order/
// text, or a readFileSync of the app's own comms.css TEXT for a claim that
// is inherently a CSS fact -- the design pack is never re-read as its own
// proof (DEC-976/DEC-967). Every DOM/CSS lookup runs BEFORE its citation
// comment (DEC-976 wave-116 EXPECT_PROXIMITY_LINES).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommsPage } from './Comms';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests, resetInitialStoredIdForTests } from '../lib/useCurrentEvent';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Comms.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-comms-desktop-verdicts';

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
  vi.unstubAllGlobals();
  // Comms.frame-verdicts.render.test.tsx's own afterEach shape: the events
  // cache and the D19 frozen (fromUrl, fromStorage) pair are module-level,
  // scoped to one real page load -- a render-test suite doesn't get that
  // between it() blocks without resetting explicitly.
  resetEventsCacheForTests();
  resetInitialStoredIdForTests();
});

function renderTab(tab: string, routes: Record<string, unknown>) {
  mockApi({
    'GET /api/v1/events': listEnvelope([{ id: EVENT_ID, slug: 'devflow-2027', name: 'DevFlow Conf 2027' }]),
    ...routes,
  });
  return render(
    <MemoryRouter initialEntries={[`/comms?tab=${tab}`]}>
      <CommsPage />
    </MemoryRouter>,
  );
}

describe('v12 Comms DESKTOP (1600) frames: per-frame render verdict receipts (w23-e, DEC-976 wave-23 amendment)', () => {
  // ---------------------------------------------------------------------
  // Frame :222/:225-267 "Templates" (1600)
  // ---------------------------------------------------------------------
  describe('frame :222 "Templates" (1600)', () => {
    const TEMPLATE = {
      id: 'tmpl-accept',
      eventId: EVENT_ID,
      name: 'Acceptance',
      subject: 'Your talk has been accepted to {event_name}',
      bodyText: "Hi {speaker_name}, congratulations. Your session '{talk_title}' has been accepted.",
      lastUsedAt: Date.parse('2026-08-11T16:12:00Z'),
    };

    function renderTemplates() {
      return renderTab('templates', {
        [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([TEMPLATE]),
      });
    }

    it('MATCHES: the drill head carries breadcrumb "‹ Comms", H1 "Templates", and a "New template" primary', async () => {
      renderTemplates();
      const head = await screen.findByRole('heading', { name: 'Templates' });
      const headBand = head.closest('.chq-comms-templates-head');
      // docs/design/Chautauqua Comms.dc.html:229 --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:28px; font-weight:700; letter-spacing:-0.04em; line-height:1">Templates</span>`
      verbatimLine(229, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:28px; font-weight:700; letter-spacing:-0.04em; line-height:1">Templates</span>');
      expect(headBand).not.toBeNull();
      expect(within(headBand as HTMLElement).getByRole('button', { name: '‹ Comms' })).toBeInTheDocument();
      expect(within(headBand as HTMLElement).getByRole('button', { name: 'New template' })).toBeInTheDocument();
    });

    it('DIVERGES (additively): the frame draws a bare two-column div list (Name/detail/used); the tree renders that same list as a real <table> with Name/Last used column heads', async () => {
      renderTemplates();
      await screen.findByRole('heading', { name: 'Templates' });
      const table = screen.getByRole('table');
      expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(within(table).getByRole('columnheader', { name: 'Last used' })).toBeInTheDocument();
      // docs/design/Chautauqua Comms.dc.html:239 -- the frame's list row
      // is a bare `<div style="display:grid; grid-template-columns:1fr
      // auto; ...">`, never a `<table>`/`<th>` pair.
      verbatimLine(239, '            <div style="display:grid; grid-template-columns:1fr auto; gap:14px; align-items:baseline; padding:14px 0; border-bottom:1px solid #E1DDCE">');
      expect(within(table).getByRole('button', { name: 'Acceptance' })).toBeInTheDocument();
    });

    it('MATCHES: opening Templates auto-selects the first template into the editor, eyebrow + Duplicate beside it', async () => {
      renderTemplates();
      await screen.findByRole('heading', { name: 'Templates' });
      await waitFor(() => expect(screen.getByText('Acceptance', { selector: '.chq-comms-editor-eyebrow' })).toBeInTheDocument());
      // docs/design/Chautauqua Comms.dc.html:250 --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Acceptance</span>`
      verbatimLine(250, '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Acceptance</span>');
      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    });

    it('MATCHES (DEC-993): the Insert-a-field control renders as a CLOSED "Insert a field" trigger with its own caret element, not the frame\'s permanently-open panel', async () => {
      renderTemplates();
      await screen.findByRole('heading', { name: 'Templates' });
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(TEMPLATE.subject));
      const trigger = screen.getByRole('button', { name: /Insert a field/ });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      // docs/design/Chautauqua Comms.dc.html:265 -- the frame's permanently-open caret span, carrying no closed/open state at all: `<span style="margin-left:auto; font-size:12px; color:#565A4B">▾</span>`
      verbatimLine(265, '                <span style="margin-left:auto; font-size:12px; color:#565A4B">▾</span>');
      fireEvent.click(trigger);
      expect(screen.getByRole('menu', { name: /Insert a field/ })).toBeInTheDocument();
    });

    it('MATCHES: the editor footer is Save (filled) + "Use in a send" (bordered) once a saved template is selected -- the desktop frame\'s own pairing, unlike the 390 frame\'s Save+Cancel', async () => {
      renderTemplates();
      await screen.findByRole('heading', { name: 'Templates' });
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(TEMPLATE.subject));
      // docs/design/Chautauqua Comms.dc.html:270-271 --
      // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:11px 16px; font-size:13px; font-weight:700">Save</span>` /
      // `<span style="border:1px solid #BAB6A6; border-radius:4px; padding:10px 16px; font-size:13px; font-weight:600; background:#EFEBDF">Use in a send</span>`
      verbatimLine(270, '              <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:11px 16px; font-size:13px; font-weight:700">Save</span>');
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use in a send' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :360/:364-455 "Compose · step 1 of 4" (1600)
  // ---------------------------------------------------------------------
  describe('frame :360 "Compose · step 1 of 4" (1600)', () => {
    function submission(n: number, opts: { hasSlot?: boolean } = {}) {
      return {
        id: `sub-${n}`,
        ref: `S-${String(n).padStart(3, '0')}`,
        title: `Talk number ${n}`,
        status: 'accepted',
        contentStatus: 'approved',
        speakers: [{ contactId: `c${n}`, name: `Speaker ${n}` }],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000000000,
        slot: opts.hasSlot === false ? null : { day: '2027-05-13', startMin: 600, endMin: 645 },
      };
    }

    function renderStep1() {
      return renderTab('compose', {
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: () =>
          listEnvelope(
            [submission(1), submission(2, { hasSlot: false })],
            { total: 2, page: 1, perPage: 50 },
          ),
        [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
      });
    }

    it('MATCHES: the step strip carries Recipients / Template / Preview / Send, in that order', async () => {
      renderStep1();
      await screen.findByText('Talk number 1');
      // Six per-status count reads (one per SUBMISSION_STATUSES member)
      // fire alongside the row fetch above -- settled here so none of them
      // resolves after this test's own cleanup() unmounts the tree.
      await waitFor(() => expect(document.querySelectorAll('.chq-comms-status-pill-count').length).toBe(6));
      const steps = [...document.querySelectorAll('.chq-comms-step-title')].map((el) => el.textContent);
      // docs/design/Chautauqua Comms.dc.html:375 -- the step strip's four
      // titles, "Recipients"/"Template"/"Preview"/"Send", in that order --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:14px; font-weight:700">Recipients</span>`
      verbatimLine(375, '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:14px; font-weight:700">Recipients</span>');
      expect(steps).toEqual(['Recipients', 'Template', 'Preview', 'Send']);
    });

    it('DIVERGES: the frame\'s step 1 opens with 23 recipients ALREADY selected ("23 accepted speakers" step detail, a live "23 selected" bulk bar); the tree\'s real entry starts with nothing selected', async () => {
      renderStep1();
      await screen.findByText('Talk number 1');
      // Six per-status count reads (one per SUBMISSION_STATUSES member)
      // fire alongside the row fetch above -- settled here so none of them
      // resolves after this test's own cleanup() unmounts the tree.
      await waitFor(() => expect(document.querySelectorAll('.chq-comms-status-pill-count').length).toBe(6));
      const recipientsDetail = document.querySelector('.chq-comms-step-detail');
      // docs/design/Chautauqua Comms.dc.html:376 --
      // `<span style="font-size:11px; color:#565A4B">23 accepted speakers</span>`
      verbatimLine(376, '              <span style="font-size:11px; color:#565A4B">23 accepted speakers</span>');
      expect(recipientsDetail?.textContent).toBe('None selected yet');
      const bulkbar = screen.getByRole('toolbar', { name: 'Selection' });
      expect(within(bulkbar).getByText('Tick rows to email selected submissions.')).toBeInTheDocument();
      expect(within(bulkbar).queryByText(/selected$/)).not.toBeInTheDocument();
    });

    it('MATCHES: the question head reads "Who is this going to?" with the "Nothing sends until step 4" reassurance', async () => {
      renderStep1();
      await screen.findByText('Talk number 1');
      // Six per-status count reads (one per SUBMISSION_STATUSES member)
      // fire alongside the row fetch above -- settled here so none of them
      // resolves after this test's own cleanup() unmounts the tree.
      await waitFor(() => expect(document.querySelectorAll('.chq-comms-status-pill-count').length).toBe(6));
      // docs/design/Chautauqua Comms.dc.html:404 --
      // `<h1 ...>Who is this going to?</h1>` / `<span ...>Nothing sends until step 4</span>`
      verbatimLine(404, '          <span style="font-size:13px; color:#565A4B">Nothing sends until step 4</span>');
      expect(screen.getByRole('heading', { name: 'Who is this going to?' })).toBeInTheDocument();
      expect(screen.getByText('Nothing sends until step 4')).toBeInTheDocument();
    });

    it('DIVERGES: the frame draws exactly THREE status pills (Accepted/Declined/Waitlisted); the tree renders all SIX submission-pipeline statuses as pills', async () => {
      renderStep1();
      await screen.findByText('Talk number 1');
      // Six per-status count reads (one per SUBMISSION_STATUSES member)
      // fire alongside the row fetch above -- settled here so none of them
      // resolves after this test's own cleanup() unmounts the tree.
      await waitFor(() => expect(document.querySelectorAll('.chq-comms-status-pill-count').length).toBe(6));
      const pillGroup = screen.getByRole('group', { name: 'Status' });
      const pillLabels = within(pillGroup).getAllByRole('checkbox').map((el) => el.closest('label')?.textContent?.replace(/\s*·\s*\d+$/, ''));
      // docs/design/Chautauqua Comms.dc.html:408-410 -- three pills:
      // `Accepted · 23` / `Declined · 11` / `Waitlisted · 4`.
      verbatimLine(408, '          <span style="background:#1B1D17; color:#F4F1E8; border-radius:99px; padding:7px 14px; font-size:13px; font-weight:600">Accepted · 23</span>');
      expect(pillLabels).toEqual(['Pending', 'Accept queue', 'Decline queue', 'Accepted', 'Declined', 'Waitlisted']);
    });

    it('MATCHES: the recipient table carries the Submission/Speakers/Status/Slot column order, and an unslotted row carries the "No slot yet" flag', async () => {
      renderStep1();
      await screen.findByText('Talk number 1');
      // Six per-status count reads (one per SUBMISSION_STATUSES member)
      // fire alongside the row fetch above -- settled here so none of them
      // resolves after this test's own cleanup() unmounts the tree.
      await waitFor(() => expect(document.querySelectorAll('.chq-comms-status-pill-count').length).toBe(6));
      const table = screen.getByRole('table');
      const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent);
      // docs/design/Chautauqua Comms.dc.html:425 -- the column head row's
      // order: checkbox / Submission / Speaker / Status / Slot --
      // `<span>☑</span><span>Submission</span><span>Speaker</span><span>Status</span><span>Slot</span>`
      verbatimLine(425, '            <span>☑</span><span>Submission</span><span>Speaker</span><span>Status</span><span>Slot</span>');
      expect(heads).toEqual(['', 'Submission', 'Speakers', 'Status', 'Slot']);
      expect(within(table).getByText('No slot yet')).toBeInTheDocument();
    });

    it('MATCHES: the footer is a right-flushed Cancel + "Next: choose a template" primary', async () => {
      renderStep1();
      await screen.findByText('Talk number 1');
      // Six per-status count reads (one per SUBMISSION_STATUSES member)
      // fire alongside the row fetch above -- settled here so none of them
      // resolves after this test's own cleanup() unmounts the tree.
      await waitFor(() => expect(document.querySelectorAll('.chq-comms-status-pill-count').length).toBe(6));
      const footer = document.querySelector('.chq-comms-select-footer');
      // docs/design/Chautauqua Comms.dc.html:443 --
      // `<span ...>Next: choose a template</span>`
      verbatimLine(443, '            <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Next: choose a template</span>');
      expect(within(footer as HTMLElement).getByRole('link', { name: 'Cancel' })).toBeInTheDocument();
      expect(within(footer as HTMLElement).getByRole('button', { name: 'Next: choose a template' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :544/:548-593 "Comms · nothing sent yet" (1600, empty state)
  // ---------------------------------------------------------------------
  describe('frame :544 "Comms · nothing sent yet" (1600)', () => {
    function renderFreshEmpty() {
      return renderTab('compose', {
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: () => listEnvelope([], { total: 0, page: 1, perPage: 50 }),
        [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
        // Comms.tsx's own fresh-empty check needs the all-time batch list
        // AND both seven-day totals to settle at zero -- see its
        // isFreshEmpty derivation.
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: () => {
          return listEnvelope([]);
        },
      });
    }

    it('MATCHES: the page head subtitle reads "No sends on this event" beside the H1', async () => {
      renderFreshEmpty();
      await screen.findByRole('heading', { name: 'Comms' });
      await waitFor(() => expect(document.querySelector('.chq-comms-head-subtitle')).not.toBeNull());
      const subtitle = document.querySelector('.chq-comms-head-subtitle');
      // docs/design/Chautauqua Comms.dc.html:571 --
      // `<span style="font-size:13px; color:#565A4B">No sends on this event</span>`
      verbatimLine(571, '          <span style="font-size:13px; color:#565A4B">No sends on this event</span>');
      expect(subtitle?.textContent).toBe('No sends on this event');
    });

    it('MATCHES: "You have not emailed anyone yet" empty-state heading and the decided-but-untold reason line, once the accepted count settles', async () => {
      renderFreshEmpty();
      await screen.findByRole('heading', { name: 'Comms' });
      await waitFor(() => expect(screen.getByText('You have not emailed anyone yet')).toBeInTheDocument());
      const reason = screen.getByText(/have a decision and nobody has been told/);
      // docs/design/Chautauqua Comms.dc.html:576 --
      // `<span ...>23 submissions have a decision and nobody has been told. Every send is logged here afterwards.</span>`
      verbatimLine(576, '          <span style="font-size:16px; line-height:1.65; color:#3F4237; max-width:52ch">23 submissions have a decision and nobody has been told. Every send is logged here afterwards.</span>');
      expect(reason.textContent).toBe('0 submissions have a decision and nobody has been told. Every send is logged here afterwards.');
    });

    it('MATCHES: the primary reads "Tell your accepted speakers" (count-free, since no accepted-count fixture is wired here) and the secondary reads "Read the templates ›"', async () => {
      renderFreshEmpty();
      await screen.findByRole('heading', { name: 'Comms' });
      await waitFor(() => expect(screen.getByText('You have not emailed anyone yet')).toBeInTheDocument());
      // docs/design/Chautauqua Comms.dc.html:579 --
      // `<a href="#" style="font-size:14px; font-weight:700">Read the templates ›</a>`
      verbatimLine(579, '            <a href="#" style="font-size:14px; font-weight:700">Read the templates ›</a>');
      expect(screen.getByRole('link', { name: /Read the templates/ })).toHaveAttribute('href', '/comms?tab=templates');
      expect(screen.getByRole('link', { name: /Tell (your|the 0) accepted speakers/ })).toHaveAttribute('href', '/comms?tab=compose');
    });

    it('DIVERGES (additively): the frame draws only the H1 + empty state, no tab strip; the tree always renders the Compose/Templates/History tablist above every tab\'s body, including this fresh-empty state', async () => {
      renderFreshEmpty();
      await screen.findByRole('heading', { name: 'Comms' });
      // docs/design/Chautauqua Comms.dc.html:548 draws the frame's own
      // 1600px shell with no `role="tablist"` region anywhere inside it.
      verbatimLine(548, '    <div style="width:1600px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:6px; overflow:hidden; box-shadow:0 18px 44px rgba(27,29,23,0.13)">');
      const tablist = screen.getByRole('tablist');
      expect(within(tablist).getByRole('tab', { name: 'Compose' })).toBeInTheDocument();
      expect(within(tablist).getByRole('tab', { name: 'Templates' })).toBeInTheDocument();
      expect(within(tablist).getByRole('tab', { name: 'History' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :589/:593-680 "Comms · history" (1600)
  // ---------------------------------------------------------------------
  describe('frame :589 "Comms · history" (1600)', () => {
    const BATCH = {
      batchKey: 'batch-1',
      subject: 'Your talk has been accepted to DevFlow Conf 2027',
      sentAt: Date.parse('2026-08-11T16:12:00Z'),
      statusCounts: { sent: 23 },
      templateId: 'tmpl-accept',
    };

    function renderHistory() {
      // mockApi keys by path only (query strings stripped), so the initial
      // "?groupBy=batch" batch-list read (fired once by Comms.tsx and once
      // by HistoryTab, both on mount) and the "?batchId=" per-batch
      // recipients read a row's own "Open" toggle fires below collide on
      // the SAME "GET .../email-log" key. A call-order counter serves the
      // batch-shaped envelope for the first two calls and a properly
      // ID-bearing EmailLogRow envelope from the third call onward, so the
      // recipients disclosure this test opens never renders a keyless row.
      let calls = 0;
      return renderTab('history', {
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: () => {
          calls += 1;
          if (calls <= 2) return listEnvelope([BATCH], { total: 1, page: 1, perPage: 50 });
          return listEnvelope(
            [{ id: 'log-1', toEmail: 'priya@example.com', status: 'sent', subject: BATCH.subject, templateId: BATCH.templateId }],
            { total: 1 },
          );
        },
        [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
          { id: 'tmpl-accept', eventId: EVENT_ID, name: 'Acceptance', subject: 'x', bodyText: 'y', lastUsedAt: BATCH.sentAt },
        ]),
      });
    }

    it('DIVERGES: the frame draws ONE "History" H1 as its own drill head; at desktop width the tree ALSO renders the page-level "Comms" H1 + tablist above it (only phone gates that band down)', async () => {
      renderHistory();
      await screen.findByRole('heading', { name: 'History' });
      // docs/design/Chautauqua Comms.dc.html:616 --
      // `<h1 ...>History</h1>`, the frame's ONLY page-level heading in this
      // shell -- no second "Comms" H1 anywhere above it.
      verbatimLine(616, '            <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:36px; font-weight:700; letter-spacing:-0.04em; line-height:1">History</h1>');
      expect(screen.getByRole('heading', { name: 'Comms' })).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('MATCHES: the History drill head carries "‹ Comms", the count line, and right-flushed Export CSV + Compose', async () => {
      renderHistory();
      const heading = await screen.findByRole('heading', { name: 'History' });
      const head = heading.closest('.chq-comms-history-head');
      // docs/design/Chautauqua Comms.dc.html:620-621 --
      // `<a ...>Export CSV</a>` / `<span ...>Compose</span>`
      verbatimLine(620, '            <a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:9px 15px; font-size:13px; font-weight:600; color:#1B1D17">Export CSV</a>');
      expect(within(head as HTMLElement).getByRole('button', { name: '‹ Comms' })).toBeInTheDocument();
      expect(within(head as HTMLElement).getByText(/1 send/)).toBeInTheDocument();
      expect(within(head as HTMLElement).getByRole('link', { name: 'Export CSV' })).toBeInTheDocument();
      expect(within(head as HTMLElement).getByRole('button', { name: 'Compose' })).toBeInTheDocument();
    });

    it('MATCHES: the chip row carries "All sends" (active by default) plus one chip per template', async () => {
      renderHistory();
      await screen.findByRole('heading', { name: 'History' });
      // docs/design/Chautauqua Comms.dc.html:626 --
      // `<span ...>All sends</span>`
      verbatimLine(626, '          <span style="background:#1B1D17; color:#F4F1E8; border-radius:99px; padding:7px 14px; font-size:13px; font-weight:600">All sends</span>');
      const allSends = screen.getByRole('button', { name: 'All sends' });
      expect(allSends).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Acceptance' })).toBeInTheDocument();
    });

    it('MATCHES: the table renders When/Subject/Recipients/Template column heads over the SAME grid the batch rows use', async () => {
      renderHistory();
      await screen.findByRole('heading', { name: 'History' });
      await waitFor(() => expect(screen.getByText(BATCH.subject)).toBeInTheDocument());
      const headsRow = document.querySelector('.chq-comms-batch-col-heads-row');
      // docs/design/Chautauqua Comms.dc.html:635 --
      // `<span>When</span><span>Subject</span><span>Recipients</span><span>Template</span><span></span>`
      verbatimLine(635, '            <span>When</span><span>Subject</span><span>Recipients</span><span>Template</span><span></span>');
      expect(headsRow?.textContent).toBe('WhenSubjectRecipientsTemplate');
    });

    it('MATCHES: a batch row\'s "Open" toggle expands into a "Close" state, arming the recipients disclosure region', async () => {
      renderHistory();
      await screen.findByRole('heading', { name: 'History' });
      await waitFor(() => expect(screen.getByText(BATCH.subject)).toBeInTheDocument());
      const openBtn = screen.getByRole('button', { name: 'Open' });
      expect(openBtn).toHaveAttribute('aria-expanded', 'false');
      // docs/design/Chautauqua Comms.dc.html:644 --
      // `<a href="#" style="font-size:12px; font-weight:700">Open</a>`
      verbatimLine(644, '              <a href="#" style="font-size:12px; font-weight:700">Open</a>');
      fireEvent.click(openBtn);
      const closeBtn = await screen.findByRole('button', { name: 'Close' });
      expect(closeBtn).toHaveAttribute('aria-expanded', 'true');
      expect(document.querySelector('.chq-comms-batch-recipients')).not.toBeNull();
    });
  });
});
