// w31-e (DEC-976 wave-31): the frame's FIRST markup-level verdict for both
// "Submissions" 390 (docs/design/Chautauqua Submissions.dc.html:137-181,
// 13/16 literals previously asserted) and "Submission detail" 390
// (docs/design/Chautauqua Submissions.dc.html:355-393, 10/15 previously
// asserted). Until this file the landing frame's head/row/tab-band anatomy
// was claimed only from CSS-text scans (submissions-phone-frames.test.ts)
// and the detail frame's dock only from SubmissionDetailPage.phone-dock.
// render.test.tsx's own shallow structural checks -- this file mounts BOTH
// REAL routes (the exact mount copied verbatim from Submissions.render.
// test.tsx and SubmissionDetailPage.render.test.tsx/.phone-dock.render.
// test.tsx, never a second mock stack, DEC-663) and asserts DOM
// structure/order (jsdom applies no @media, so every claim here is about
// markup, never computed geometry).
//
// DEC-967 wave-31: structural copy graded by literal, sample data graded by
// SHAPE -- `{{ row.* }}` / `{{ a.* }}` / `{{ r.* }}` rows and the seeded
// talk title "Docs That Answer Back: Retrieval-Grounded Documentation
// Sites" are never pinned to the frame's own sample strings.
//
// DEC-576 wave-31 tie-break (this file's own honoured rulings):
//  (1) the DETAIL frame's third dock action is RULED 'Waitlist' -- never
//      the frame's own word 'Wait', and never 'Read' (that word belongs to
//      the OTHER, LANDING frame's row action, never this dock) -- exactly
//      one Accept, one Decline, one Waitlist, as SubmissionDetailPage.
//      phone-dock.render.test.tsx already pins. The detail frame's 'Wait'
//      is recorded below as a settled DIVERGES row.
//  (2) DEVIATIONS.md's "Co-presenter add row keeps its no-email truth"
//      entry governs `Chautauqua Submissions.dc.html:298`, outside both of
//      this file's line ranges (137-181, 355-393) -- not graded here, the
//      app's truthful sentence is a submissions.tsx-lane concern this
//      file's scope does not reach.
//  (3) DEVIATIONS.md's "Submissions 390 phone head, DEC-919 amendment
//      (wave 7, task w7-e)" entry governs the LANDING frame's head band --
//      graded against it (re-lined Forms / Export CSV / New submission
//      actions), never against a literal read of the frame's "no action
//      buttons" head.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionsPage } from '../Submissions';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Submissions.dc.html');

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

// ---------------------------------------------------------------------
// "Submissions" 390 -- see the describe() below for the frame citation.
// ---------------------------------------------------------------------

const EVENT_ID = 'evt-frame390-1';

function renderLanding() {
  return render(
    <MemoryRouter>
      <SubmissionsPage />
    </MemoryRouter>,
  );
}

describe('v12 frame render verdict "Submissions · 390" (task w31-e, DEC-976 wave-31)', () => {
  beforeEach(() => {
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  });

  it('renders the real /submissions route: head band, per-row stack, bulk bar, tab band', async () => {
    // :144 `<h1 ...>Submissions</h1>` -- structural copy, literal.
    verbatimLine(
      144,
      '          <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Submissions</h1>',
    );
    // :147 the search field's placeholder copy.
    verbatimLine(
      147,
      '        <div style="border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:14px; color:#565A4B; background:#FAF8F2">Search title or speaker…</div>',
    );
    // :149-151 the three-chip strip's own copy.
    verbatimLine(
      149,
      '          <span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:600">Needs triage</span>',
    );
    verbatimLine(
      150,
      '          <span style="flex-shrink:0; border:1px solid #BAB6A6; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:13px; font-weight:500">Accepted</span>',
    );
    // :165-167 the per-row card action triple's own copy (Accept / Decline
    // / Read -- 'Read', never 'Waitlist', is honoured below).
    verbatimLine(
      165,
      '              <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Accept</span>',
    );
    verbatimLine(
      166,
      '              <span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Decline</span>',
    );
    verbatimLine(
      167,
      '              <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; padding:0 14px; font-size:13px; font-weight:600">Read</span>',
    );

    mockApi({
      'GET /api/v1/me': { userId: 'user-1', email: 'organizer@example.com', name: 'Organizer', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Docs', color: '#4f46e5' }]),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-390-1',
          ref: 'DFC-033',
          title: 'Docs That Answer Back: Retrieval-Grounded Documentation Sites',
          status: 'pending',
          contentStatus: 'pending',
          speakers: [{ contactId: 'c1', name: 'Dana Whitmore' }],
          trackIds: ['trk1'],
          submittedAt: null,
          createdAt: 1700000000000,
        },
      ]),
    });

    renderLanding();

    // docs/design/Chautauqua Submissions.dc.html:137-181 is the whole
    // "Submissions · 390" phone frame, opening with
    // `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`.
    // :144 -- exactly one <h1> reading the frame's literal title.
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Submissions' })).toBeInTheDocument();

    // HEAD BAND (honoured against DEVIATIONS' DEC-919 amendment, not a
    // literal read of the frame's "no action buttons" head): the titles
    // row plus a re-lined actions row (Forms / Export CSV / New
    // submission), each inside the shared `.chq-submissions-head`.
    const head = document.querySelector('.chq-submissions-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector('.chq-submissions-head-titles')).not.toBeNull();
    const headActions = head!.querySelector('.chq-submissions-head-actions');
    expect(headActions).not.toBeNull();
    expect(within(headActions as HTMLElement).getByRole('link', { name: 'Forms' })).toBeInTheDocument();
    expect(within(headActions as HTMLElement).getByRole('link', { name: 'Export CSV' })).toBeInTheDocument();
    expect(within(headActions as HTMLElement).getByRole('button', { name: 'New submission' })).toBeInTheDocument();

    // :145 -- the summary line sits beside the H1 -- graded by SHAPE
    // (never the frame's own "12 awaiting triage" sample count).
    await waitFor(() => {
      const summary = head!.querySelector('.chq-summary');
      expect(summary).not.toBeNull();
      expect(summary!.textContent).toMatch(/^\d+ total( · \d+ awaiting triage)?$/);
    });

    // :147 -- the search field carries the frame's exact placeholder copy.
    expect(screen.getByPlaceholderText('Search title or speaker…')).toBeInTheDocument();

    // :148-151 -- the three-chip strip: 'Needs triage' / 'Accepted' /
    // 'All N' (SHAPE on the count, never the frame's own '47').
    const pills = document.querySelector('.chq-status-pills');
    expect(pills).not.toBeNull();
    expect(within(pills as HTMLElement).getByText('Needs triage')).toBeInTheDocument();
    expect(within(pills as HTMLElement).getByRole('button', { name: 'Accepted' })).toBeInTheDocument();
    await waitFor(() => {
      const allChip = pills!.querySelector('.chq-submissions-status-all');
      expect(allChip).not.toBeNull();
      expect(allChip!.textContent).toMatch(/^All \d+$/);
    });

    // TAB BAND -- this page's own saved-view tab strip
    // (`.chq-submissions-viewtabs`, ViewTabs.tsx). The frame's bottom app
    // tab bar (:173-180) is shell chrome outside this component's tree
    // (recorded as a DIVERGES/out-of-scope row in this task's audit file,
    // consistent with submissions-phone-frames.test.ts's own "OUT OF
    // SCOPE" note for the same lines).
    await waitFor(() => {
      expect(document.querySelector('.chq-submissions-viewtabs')).not.toBeNull();
    });

    // PER-ROW STACK SHAPE (:158-168): ref/status on one baseline, title,
    // then the 'speakers · track · format' summary line, then the
    // Accept/Decline/Read action triple -- graded by SHAPE, never the
    // frame's own sample strings.
    await waitFor(() => {
      expect(screen.getByText('DFC-033')).toBeInTheDocument();
    });
    const row = screen.getByText('DFC-033').closest('tr')!;
    expect(row.querySelector('.chq-submissions-table-title')).toHaveTextContent(
      'Docs That Answer Back: Retrieval-Grounded Documentation Sites',
    );
    // The frame's single 'speakers · track · format' line (:163) is a
    // CSS-only relining (submissions-phone-frames.test.ts already pins the
    // phone stylesheet's own `::before` separator rules) of separate <td>
    // cells that jsdom renders unjoined (DEC-385: no @media applies here)
    // -- assert the constituent data cells instead of a joined text node.
    const cells = row.querySelectorAll('td');
    expect(cells[3]).toHaveTextContent('Dana Whitmore'); // speakers cell (:163's "speakers" segment)
    expect(cells[4]).toHaveTextContent('Docs'); // track cell (:163's "track" segment)

    // :164-167 -- Accept / Decline / Read, in that order, exactly once
    // each. 'Read' is honoured here as the ruled word (DEC-610 amendment):
    // the frame's own literal at :167 IS 'Read' too, so this is a literal
    // match, not a divergence -- recorded in the audit file for
    // completeness alongside the detail dock's real 'Wait' divergence.
    const triage = row.querySelector('.chq-submissions-row-triage')!;
    const triageButtons = within(triage as HTMLElement).getAllByRole('button');
    const triageLinks = within(triage as HTMLElement).getAllByRole('link');
    expect(triageButtons.map((b) => b.textContent)).toEqual(['Accept', 'Decline']);
    expect(triageLinks.map((l) => l.textContent)).toEqual(['Read']);
    expect(within(triage as HTMLElement).queryByRole('button', { name: 'Waitlist' })).toBeNull();
    expect(within(triage as HTMLElement).queryByRole('link', { name: 'Waitlist' })).toBeNull();

    // ALWAYS-MOUNTED BULK BAR: idle-state hint text, never unmounted, a
    // DEC-663-blessed frame-silent addition (the frame draws no bulk bar
    // at all in this range) -- recorded as a settled addition, not a
    // divergence, in the audit file.
    const bulkbar = document.querySelector('.chq-submissions-bulkbar');
    expect(bulkbar).not.toBeNull();
    expect(bulkbar).toHaveClass('chq-bulkbar-idle');
    expect(screen.getByText('Tick rows to change status or email speakers.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------
// "Submission detail" 390 -- see the describe() below for the frame citation.
// ---------------------------------------------------------------------

const SUB_ID = 'sub-detail-390-1';

function baseDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SUB_ID,
    eventId: 'evt-detail-1',
    ref: 'DFC-033',
    title: 'Docs That Answer Back: Retrieval-Grounded Documentation Sites',
    description:
      'A 10-minute tour of turning a static docs site into one that answers questions with citations, stays honest when it does not know, and costs under $50 a month to run.',
    status: 'pending',
    contentStatus: 'pending',
    trackId: null,
    trackIds: [] as string[],
    formId: null,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    participants: [
      {
        id: 'part-1',
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
    slot: null as { day: string; startMin: number; endMin: number; roomName: string | null } | null,
    ...overrides,
  };
}

function mockDetailEndpoints() {
  mockApi({
    [`GET /api/v1/submissions/${SUB_ID}`]: () => baseDetail(),
    [`GET /api/v1/events/evt-detail-1`]: { id: 'evt-detail-1', timezone: 'UTC' },
    [`GET /api/v1/events/evt-detail-1/tracks`]: { items: [], total: 0, page: 1, perPage: 20 },
    [`GET /api/v1/events/evt-detail-1/forms`]: { id: 'form-1', fields: [] },
    [`GET /api/v1/submissions/${SUB_ID}/evaluations`]: {
      items: [
        {
          planId: 'plan-1',
          planName: 'Content review',
          round: 1,
          reviewerName: 'Priya Raman',
          scores: {},
          criteria: [],
          score: 4.5,
          comment: 'Strong, practical talk.',
          submittedAt: 1700000100000,
        },
      ],
      assigned: 3,
    },
  });
}

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/submissions/${SUB_ID}`]}>
      <Routes>
        <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('v12 frame render verdict "Submission detail · 390" (task w31-e, DEC-976 wave-31)', () => {
  it('renders the real /submissions/:id route at phone width: head, answers, reviews, and the three-action dock', async () => {
    // :358 the back link's short phone label.
    verbatimLine(358, '          <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Triage</a>');
    // :375 the Reviews section title -- graded by SHAPE below (never the
    // frame's own '3 of 3' sample).
    verbatimLine(
      375,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Reviews · 3 of 3 in</span>',
    );
    // :389-391 the three-action dock's own copy -- 'Accept' / 'Decline' /
    // 'Wait'. The dock's ruled accessible names are honoured (1) below:
    // Accept and Decline are literal matches, 'Wait' is not (Waitlist
    // wins) -- recorded as a settled divergence in the audit file.
    verbatimLine(
      389,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Accept</span>',
    );
    verbatimLine(
      390,
      '        <span style="flex:1; border:1px solid #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Decline</span>',
    );
    verbatimLine(
      391,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Wait</span>',
    );

    stubPhoneMatchMedia();
    mockDetailEndpoints();
    renderDetail();

    // docs/design/Chautauqua Submissions.dc.html:355-393 opens with
    // `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`;
    // :361-362 draws exactly one <h1>, graded by SHAPE below (never
    // pinned to the frame's own sample title).
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/\S/);

    // :358 -- the back link's short label, present in the DOM (jsdom
    // applies no @media, so both spans exist -- the SHORT one is the
    // frame's own phone word, per DEC-919 wave-98).
    const backShort = document.querySelector('.chq-detail-back-short');
    expect(backShort).not.toBeNull();
    expect(backShort).toHaveTextContent('Triage');

    // :359 -- the bare 'N of M' position counter -- SHAPE only.
    const posCount = document.querySelector('.chq-detail-ref-position-count');
    if (posCount) {
      expect(posCount.textContent).toMatch(/^\d+ of \d+$/);
    }

    // :363 -- the byline under the title -- SHAPE only (never the frame's
    // own 'Dana Whitmore · Fieldnote Docs' sample).
    await waitFor(() => {
      const byline = document.querySelector('.chq-detail-byline');
      expect(byline).not.toBeNull();
      expect(byline!.textContent).toMatch(/\S+.* · .+/);
    });

    // :364 the abstract paragraph -- present, non-empty (SHAPE only).
    const abstract = document.querySelector('.chq-detail-abstract');
    expect(abstract).not.toBeNull();
    expect(abstract!.textContent!.length).toBeGreaterThan(0);

    // :365-368 the answer-row stack ({{ a.label }} / {{ a.value }}) --
    // structural container present (SHAPE; this seed has no custom answer
    // fields, so the list itself may be empty -- the section exists
    // regardless).
    expect(screen.getByRole('heading', { name: 'Form answers' })).toBeInTheDocument();

    // :369 Reviews heading -- SHAPE ('Reviews · N of M in'), never the
    // frame's own '3 of 3'.
    await waitFor(() => {
      const reviewsHeading = screen.getByRole('heading', { name: /^Reviews/ });
      expect(reviewsHeading.textContent).toMatch(/^Reviews\s*·\s*\d+ of \d+ in$/);
    });

    // :371-378 the review-row stack ({{ r.who }} / {{ r.score }} /
    // {{ r.text }}) -- SHAPE, never the frame's own sample reviewer text.
    await waitFor(() => {
      expect(document.querySelector('.chq-review-entry')).not.toBeNull();
    });
    const reviewEntry = document.querySelector('.chq-review-entry')!;
    expect(reviewEntry.querySelector('strong')).toHaveTextContent('Priya Raman');
    expect(reviewEntry.querySelector('.chq-review-entry-score')).toHaveTextContent(/\S/);
    expect(reviewEntry.querySelector('.chq-review-comment')).toHaveTextContent('Strong, practical talk.');

    // THREE-ACTION DOCK (:388-390), honoured per DEC-576 tie-break (1):
    // mounted inside `.chq-phone-dock`, exactly one Accept, one Decline,
    // one Waitlist -- never 'Wait', never 'Read' (that word belongs to the
    // OTHER, landing frame's row action).
    const dock = document.querySelector('.chq-phone-dock');
    expect(dock).not.toBeNull();
    expect(within(dock as HTMLElement).getAllByRole('button', { name: 'Accept' })).toHaveLength(1);
    expect(within(dock as HTMLElement).getAllByRole('button', { name: 'Decline' })).toHaveLength(1);
    expect(within(dock as HTMLElement).getAllByRole('button', { name: 'Waitlist' })).toHaveLength(1);
    expect(within(dock as HTMLElement).queryByRole('button', { name: 'Wait' })).toBeNull();
    expect(within(dock as HTMLElement).queryByRole('button', { name: 'Read' })).toBeNull();
    // The desktop aside never duplicates the dock's decision rail at
    // phone width (DEC-610).
    expect(document.querySelector('.chq-detail-aside .chq-detail-decision-rail')).toBeNull();
  });
});
