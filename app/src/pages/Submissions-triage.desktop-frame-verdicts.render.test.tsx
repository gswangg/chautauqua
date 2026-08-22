// w26-f: the per-frame DESKTOP (1600) render verdict for the THREE
// Submissions frames v12m-w23-f's 5-of-8 ledger
// (app/src/pages/Submissions.frame-verdicts.render.test.tsx -- the 390
// phone ledger, a different file, DEC-976) does not own: :28 "Triage at
// volume · 1600", :187 "Submission detail · /submissions/:id", :495 "New
// submission". Sibling to Speakers.desktop-frame-verdicts.render.test.tsx
// (w14-sh, DEC-930 wave-158 amendment) -- harness copied verbatim from that
// landed file.
//
// STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this file moves no desktop
// byte and edits no component/stylesheet -- it renders the real route,
// verdicts what the tree actually produces, and files divergences in prose.
// jsdom applies no stylesheet (no @media), so every assertion here is DOM
// structure/order/text, or a readFileSync of the app's own stylesheet TEXT
// for an inherently-CSS claim -- the design pack is never re-read as its
// own proof (DEC-976/DEC-967). Every DOM/CSS lookup runs BEFORE its
// citation comment so the citation sits immediately beside the `expect(`
// that receipts it (DEC-976 wave-116's EXPECT_PROXIMITY_LINES window).
//
// The bulk bar's action set is authored by DEC-752/DEC-825 (the "which
// moves does the bar offer for this status filter" ruling) -- a prior wave
// cited a different, unrelated decision for this surface, so the mandate's
// citation-corrections section flags that mismatch and it is not repeated
// here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionsPage } from './Submissions';
import { SubmissionDetailPage } from './submissions/SubmissionDetailPage';
import { NewSubmissionModal } from './submissions/NewSubmissionModal';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import type { SubmissionDetail } from './submissions/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Submissions.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from Speakers.desktop-frame-verdicts.
 * render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-submissions-desktop-verdicts';
const SUB_ID = 'sub-desktop-1';

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
});

describe('v12 Submissions DESKTOP (1600) frames: per-frame render verdict receipts (w26-f)', () => {
  // ---------------------------------------------------------------------
  // Frame :28 "Triage at volume · 1600"
  // ---------------------------------------------------------------------
  describe('frame :28 "Triage at volume · 1600"', () => {
    function renderTriage() {
      mockApi({
        'GET /api/v1/me': {
          userId: 'user-1',
          email: 'organizer@example.com',
          name: 'Organizer',
          role: 'organizer',
          orgId: 'org-1',
        },
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-1', name: 'Developer Experience' }]),
        [`GET /api/v1/events/${EVENT_ID}/forms`]: {
          id: 'form-1',
          fields: [{ id: 'f-format', section: 'session', kind: 'dropdown', label: 'Format', required: false, position: 0, options: ['Talk (30 min)'] }],
        },
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(
          [
            {
              id: 'sub-1',
              ref: 'S-001',
              title: 'Docs That Answer Back',
              status: 'pending',
              contentStatus: 'pending',
              speakers: [{ contactId: 'c1', name: 'Dana Whitmore' }],
              trackIds: ['trk-1'],
              submittedAt: 1700000000000,
              createdAt: 1700000000000,
              slot: null,
              answers: { 'f-format': 'Talk (30 min)' },
            },
          ],
          { total: 47 },
        ),
      });
      return render(
        <MemoryRouter>
          <SubmissionsPage />
        </MemoryRouter>,
      );
    }

    it('MATCHES: the table\'s column head set/order is Ref, Title, Speakers, Track, Status, Sent, Format', async () => {
      renderTriage();
      const table = await screen.findByRole('table');
      // The Format column is added to visibleFieldIds by SubmissionsTable's
      // own picker-init effect (DEC-243), which runs one tick after the
      // forms fetch resolves -- wait for its header to land before reading
      // the row.
      await waitFor(() => expect(within(table).getByText('Format')).toBeInTheDocument());
      const headers = within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent);
      // docs/design/Chautauqua Submissions.dc.html:104 -- the frame's
      // header row: `<span>☐</span><span>Ref</span><span>Title</span><span>Speakers</span><span>Track</span><span>Status</span><span>Sent</span><span>Format</span><span></span>`
      verbatimLine(
        104,
        '            <span>☐</span><span>Ref</span><span>Title</span><span>Speakers</span><span>Track</span><span>Status</span><span>Sent</span><span>Format</span><span></span>',
      );
      // The app's checkbox-select head cell and the two trailing blank
      // (Clone / end) cells carry no text -- filtering to the named
      // columns yields the frame's own order exactly.
      expect(headers.filter((h) => h && h.trim() !== '')).toEqual(['Ref', 'Title', 'Speakers', 'Track', 'Status', 'Sent', 'Format']);
    });

    it('MATCHES: the filter row is a Status caption + status pills + a divider + the track select + the column picker, in that order', async () => {
      renderTriage();
      await screen.findByRole('heading', { name: 'Submissions' });
      const bar = document.querySelector('.chq-submissions-filterbar');
      // docs/design/Chautauqua Submissions.dc.html:81 -- the frame's Status
      // caption opening the second toolbar row.
      verbatimLine(
        81,
        '            <span style="font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#565A4B; margin-right:4px">Status</span>',
      );
      expect(bar).not.toBeNull();
      const children = [...(bar as HTMLElement).children].map((el) => el.className);
      expect(children).toEqual([
        'chq-submissions-status-label',
        'chq-status-pills',
        'chq-submissions-filterbar-divider',
        'chq-select chq-submissions-filterbar-select',
        expect.stringContaining('chq-submissions-columnpicker'),
      ]);
    });

    it('DIVERGES (additively): the bulk bar\'s move set agrees with the frame\'s three chips (Move to accept queue / Decline queue / Waitlist) but the tree adds a fourth "Email these N" link before Clear -- DEC-752/DEC-825 is the move set\'s own authority, not DEC-919', async () => {
      renderTriage();
      await screen.findByRole('heading', { name: 'Submissions' });
      const table = await screen.findByRole('table');
      const checkboxes = within(table).getAllByRole('checkbox', { name: /^Select S-/ });
      checkboxes[0]!.click();
      const toolbar = screen.getByRole('toolbar', { name: 'Bulk actions' });
      const actionLabels = within(toolbar)
        .getAllByRole('button')
        .map((b) => b.textContent)
        .concat(within(toolbar).getAllByRole('link').map((l) => l.textContent));
      // docs/design/Chautauqua Submissions.dc.html:95-98 -- the frame's bulk
      // bar draws exactly `Move to accept queue` / `Decline queue` /
      // `Waitlist` / `Clear`, no email action.
      verbatimLine(98, '            <a href="#" style="font-size:12px; font-weight:700; padding:7px 4px">Clear</a>');
      expect(actionLabels.slice(0, 3)).toEqual(['Move to accept queue', 'Decline queue', 'Waitlist']);
      expect(actionLabels).toContain('Clear');
      expect(actionLabels.some((label) => label?.startsWith('Email these'))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :187 "Submission detail · /submissions/:id"
  // ---------------------------------------------------------------------
  describe('frame :187 "Submission detail · /submissions/:id"', () => {
    function baseDetail(): SubmissionDetail {
      return {
        id: SUB_ID,
        eventId: EVENT_ID,
        ref: 'S-033',
        title: 'Docs That Answer Back: Retrieval-Grounded Documentation Sites',
        description: 'A 10-minute tour.',
        status: 'pending',
        contentStatus: 'pending',
        trackId: null,
        trackIds: [],
        formId: null,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        participants: [
          {
            id: 'p-1',
            contactId: 'c-1',
            name: 'Dana Whitmore',
            email: 'dana@example.com',
            title: 'Documentation Lead',
            company: 'Fieldnote Docs',
            role: 'speaker',
            order: 0,
            visible: true,
            inviteStatus: 'accepted',
            submissionsThisYear: 2,
            lastSpokeYear: 2026,
          },
        ],
        answers: {},
        answerFiles: [],
        slot: null,
      };
    }

    function renderDetail() {
      mockApi({
        [`GET /api/v1/submissions/${SUB_ID}`]: baseDetail(),
        [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, timezone: 'UTC' },
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
        [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: { items: [], assigned: 0 },
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      });
      return render(
        <MemoryRouter initialEntries={[`/submissions/${SUB_ID}`]}>
          <Routes>
            <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: the main column\'s section order is Abstract, Form answers, Reviews, Session details', async () => {
      renderDetail();
      await screen.findByRole('heading', { name: /Docs That Answer Back/ });
      const main = document.querySelector('.chq-detail-main');
      // Reviews/Session details carry a trailing caption ("· N of M in" /
      // "Editable until the schedule is published") in the SAME h2 --
      // .chq-detail-section-title-text (when present) is the title's own
      // text node; otherwise split off the middot-joined caption.
      const headings = within(main as HTMLElement)
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.querySelector('.chq-detail-section-title-text')?.textContent ?? h.textContent?.split(/[·]/)[0]?.trim());
      // docs/design/Chautauqua Submissions.dc.html:233 -- the frame's second
      // main-column section title, between Abstract (:226) and Reviews
      // (:245).
      verbatimLine(
        233,
        '                <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Form answers</span>',
      );
      expect(headings).toEqual(['Abstract', 'Form answers', 'Reviews', 'Session details']);
    });

    it('MATCHES: the aside\'s section order is Decision, Speaker, History', async () => {
      renderDetail();
      await screen.findByRole('heading', { name: /Docs That Answer Back/ });
      const aside = document.querySelector('.chq-detail-aside');
      // History's own title renders as a <div> (not an <h2>, DEC-908 wave-
      // 42 amendment's expand-by-default disclosure header) -- read every
      // .chq-detail-section-title element directly rather than only the
      // <h2> role so all three sections are captured.
      const headings = [...(aside as HTMLElement).querySelectorAll('.chq-detail-section-title')].map(
        (el) => el.querySelector('.chq-detail-section-title-text')?.textContent ?? el.textContent,
      );
      // docs/design/Chautauqua Submissions.dc.html:322 -- the frame's aside
      // opens Decision (:307), then Speaker here, then History (:334).
      verbatimLine(
        322,
        '                <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Speaker</span>',
      );
      expect(headings).toEqual(['Decision', 'Speaker', 'History']);
    });

    it('MATCHES: the decision rail\'s pending-state tertiary action is accessibly named "Waitlist" -- never "Wait" and never "Read", agreeing with the frame\'s own drawn third chip', async () => {
      renderDetail();
      await screen.findByRole('heading', { name: /Docs That Answer Back/ });
      const rail = document.querySelector('.chq-detail-decision-rail');
      const buttons = within(rail as HTMLElement).getAllByRole('button');
      // docs/design/Chautauqua Submissions.dc.html:314 -- the frame's own
      // decision rail draws its third chip as "Waitlist", not "Wait" and
      // not "Read".
      verbatimLine(
        314,
        '                  <span style="flex:1; border:1px solid #BAB6A6; border-radius:4px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Waitlist</span>',
      );
      expect(buttons.map((b) => b.textContent)).toEqual(['Accept', 'Decline', 'WaitlistWait']);
      const tertiary = buttons[2]!;
      expect(tertiary).toHaveAccessibleName('Waitlist');
      expect(tertiary.textContent).not.toBe('Read');
    });
  });

  // ---------------------------------------------------------------------
  // Frame :495 "New submission"
  // ---------------------------------------------------------------------
  describe('frame :495 "New submission"', () => {
    function renderModal() {
      return render(<NewSubmissionModal tracks={[]} onCancel={() => {}} onCreate={async () => {}} />);
    }

    it('DIVERGES (additively): the frame\'s four fields (Title, Abstract, Speaker name, Speaker email) all render in that order; Tracks/Format add ONLY when the event has tracks/a format field (neither seeded here, so the tree matches the frame\'s four-field set exactly)', () => {
      renderModal();
      // Optional rows (FormRow's own OPTIONAL_SUFFIX, DEC-917) append
      // " · optional" to the label text -- stripped here since it is a
      // shared FormRow affordance, not a per-field frame divergence.
      const labels = [...document.querySelectorAll('.chq-form-row-label')].map((l) =>
        l.textContent?.replace(/\s*·\s*optional$/, '').trim(),
      );
      // docs/design/Chautauqua Submissions.dc.html:508 -- the frame's first
      // field label, Title, opening the four-field body.
      verbatimLine(
        508,
        '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Title</span>',
      );
      expect(labels).toEqual(['Title', 'Abstract', 'Speaker name', 'Speaker email']);
      expect(screen.queryByText('Tracks')).not.toBeInTheDocument();
      expect(screen.queryByText('Format')).not.toBeInTheDocument();
    });

    it('MATCHES: the action row is primary-first Create it, then secondary Cancel', () => {
      renderModal();
      const actions = document.querySelector('.chq-modal-actions');
      const buttons = within(actions as HTMLElement).getAllByRole('button');
      // docs/design/Chautauqua Submissions.dc.html:521 -- the frame's
      // primary "Create it" chip, followed by "Cancel" at :522.
      verbatimLine(
        521,
        '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Create it</span>',
      );
      expect(buttons.map((b) => b.textContent)).toEqual(['Create it', 'Cancel']);
      expect(buttons[0]).toHaveClass('chq-btn-primary');
      expect(buttons[1]).toHaveClass('chq-btn-secondary');
    });
  });
});
