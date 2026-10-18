// One sponsor session, reviewed (Portals frame, flow 5): the pinned note
// on a resubmission, the submission and history, the sponsor's package,
// and the three decisions -- Approve opens the Approved receipt, Decline
// refuses to send without a reason, Request changes sends the note (the
// dialogs are SponsorDecisionModals').
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SponsorSessionReviewPage } from './SponsorSessionReviewPage';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import { resetApiCacheForTests } from '../../lib/api';
import type { AuditEventRow, SponsorDecisionResult, SponsorSessionDetail, SponsorSessionReview } from './types';

const EVENT_ID = 'evt-review';
const BASE = `/api/v1/events/${EVENT_ID}`;
const SESSION_URL = `${BASE}/sponsor-sessions/ss-ws`;
const YEAR = new Date().getUTCFullYear();
const NOTE = 'The abstract reads as a product pitch. Can you describe what attendees will build, and drop the pricing slide?';

function workshop(overrides: Partial<SponsorSessionDetail> = {}): SponsorSessionDetail {
  return {
    id: 'ss-ws',
    sponsorshipId: 'sp-lattice',
    eventId: EVENT_ID,
    companyName: 'Latticework Systems',
    tierName: 'Gold',
    entitlementId: 'ent-ws',
    slotLabel: 'Workshop · 120 min',
    format: 'Workshop (120 min)',
    minutes: 120,
    title: 'Hands-on: Build Caches from Scratch',
    abstract: 'In two hours you will build a content-addressed build cache in TypeScript.',
    status: 'submitted',
    lastNote: NOTE,
    lastNoteAt: Date.UTC(YEAR, 3, 14, 12),
    lastNoteBy: 'Jordan Alvarez',
    declineReason: null,
    submissionId: null,
    submittedAt: Date.now() - 60 * 1000,
    submitCount: 2,
    decidedAt: null,
    createdAt: Date.UTC(YEAR, 3, 1, 12),
    speakers: [
      { id: 'sss-1', contactId: 'c-priya', name: 'Priya Raman', email: 'priya@example.com', isNew: false },
      { id: 'sss-2', contactId: 'c-ana', name: 'Ana Ruiz', email: 'ana@example.com', isNew: true },
    ],
    slots: [
      { entitlementId: 'ent-talk', format: 'Talk (30 min)', minutes: 30, extra: false, session: { id: 'ss-talk', entitlementId: 'ent-talk', title: 'Build Caches at Scale', status: 'approved' } },
      { entitlementId: 'ent-ws', format: 'Workshop (120 min)', minutes: 120, extra: false, session: { id: 'ss-ws', entitlementId: 'ent-ws', title: 'Hands-on: Build Caches from Scratch', status: 'submitted' } },
    ],
    ...overrides,
  };
}

const HISTORY: AuditEventRow[] = [
  { id: 'a1', action: 'sponsor_session.submit', actorLabel: 'Priya Raman', createdAt: Date.UTC(YEAR, 3, 11, 12), details: { resubmitted: false } },
  { id: 'a2', action: 'sponsor_session.request_changes', actorLabel: 'Jordan Alvarez', createdAt: Date.UTC(YEAR, 3, 14, 12), details: { note: NOTE } },
  { id: 'a3', action: 'sponsor_session.submit', actorLabel: 'Priya Raman', createdAt: Date.now() - 60 * 1000, details: { resubmitted: true } },
];

function review(session = workshop(), history = HISTORY): SponsorSessionReview {
  return { session, history };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/speakers/sponsor-sessions/ss-ws']}>
      <Routes>
        <Route path="/speakers/sponsor-sessions/:sessionId" element={<SponsorSessionReviewPage />} />
        <Route path="/speakers/sponsor-sessions" element={<h1>The queue</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function routes(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/events': listEnvelope([{ id: EVENT_ID, name: 'DevFlow Conf 2027' }]),
    [`GET ${BASE}`]: { id: EVENT_ID, name: 'DevFlow Conf 2027', timezone: 'UTC' },
    [`GET ${SESSION_URL}`]: review(),
    ...extra,
  });
}

function postBody(fetchMock: ReturnType<typeof mockApi>, suffix: string): unknown {
  const call = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith(suffix) && init?.method === 'POST');
  return call ? JSON.parse(String(call[1]?.body ?? 'null')) : undefined;
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetEventsCacheForTests();
  resetApiCacheForTests();
});

describe('SponsorSessionReviewPage', () => {
  it('pins the last note above a resubmission, with the submission, history and package', async () => {
    routes();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Hands-on: Build Caches from Scratch' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Sponsor sessions' })).toHaveAttribute('href', '/speakers/sponsor-sessions');
    expect(screen.getByText('Latticework Systems · Gold · Workshop, 120 min · resubmitted today')).toBeInTheDocument();
    expect(await screen.findByText('You asked · 14 Apr')).toBeInTheDocument();
    expect(screen.getByText(`“${NOTE}”`)).toBeInTheDocument();
    expect(screen.getByText('(new — invited on approval)')).toBeInTheDocument();
    expect(screen.getByText('Workshop · 120 min', { selector: 'dd' })).toBeInTheDocument();

    // newest first, the request row pointing at the pinned note
    const history = screen.getByRole('region', { name: 'History' });
    const rows = within(history).getAllByRole('listitem').map((li) => li.textContent);
    expect(rows[0]).toMatch(/^Resubmitted by Priya RamanToday, \d\d:\d\d$/);
    expect(rows[1]).toBe('Changes requested by Jordan Alvarez14 Apr · note shown above');
    expect(rows[2]).toBe('Submitted by Priya Raman11 Apr');

    const panel = screen.getByRole('complementary', { name: 'Latticework Systems package' });
    expect(within(panel).getByText('Latticework Systems · Gold')).toBeInTheDocument();
    expect(within(panel).getByText('Used')).toBeInTheDocument();
    expect(within(panel).getByText('This session')).toBeInTheDocument();
    expect(within(panel).getByText('Reserved')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('does not pin a note on a first submission', async () => {
    routes({ [`GET ${SESSION_URL}`]: review(workshop({ submitCount: 1, lastNote: null, lastNoteAt: null }), [HISTORY[0]!]) });
    renderPage();
    expect(await screen.findByText(/submitted today/)).toBeInTheDocument();
    expect(screen.queryByText(/^You asked/)).not.toBeInTheDocument();
  });

  it('approves and shows the Approved receipt; Back to the queue goes to the queue', async () => {
    const result: SponsorDecisionResult = {
      session: workshop({ status: 'approved', submissionId: 'sub-9', decidedAt: Date.now() }),
      submissionId: 'sub-9',
      invited: ['Ana Ruiz'],
      told: ['Priya Raman', 'Sofia Marchetti'],
      mail: { told: { sent: 2, failed: 0 }, invited: { sent: 1, failed: 0 } },
    };
    const fetchMock = routes({ [`POST ${SESSION_URL}/approve`]: result });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approved' });
    expect(postBody(fetchMock, '/ss-ws/approve')).toBeNull();
    expect(within(dialog).getByText('Hands-on: Build Caches from Scratch')).toBeInTheDocument();
    expect(within(dialog).getByText('Accepted · Workshop · needs a slot in Agenda')).toBeInTheDocument();
    expect(within(dialog).getByText('Ana Ruiz invited')).toBeInTheDocument();
    expect(within(dialog).getByText('Gets an email to join as a speaker')).toBeInTheDocument();
    expect(within(dialog).getByText('Latticework Systems told')).toBeInTheDocument();
    expect(within(dialog).getByText('Priya Raman, Sofia Marchetti')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to the queue' }));
    expect(await screen.findByRole('heading', { name: 'The queue' })).toBeInTheDocument();
  });

  it('shows the refusal when the session was already decided', async () => {
    routes({
      [`POST ${SESSION_URL}/approve`]: { status: 409, body: errorEnvelope('conflict', 'This session was already decided.') },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('This session was already decided.')).toBeInTheDocument();
  });

  it('will not decline without a reason, then declines and says who was told', async () => {
    const fetchMock = routes({
      [`POST ${SESSION_URL}/decline`]: {
        session: workshop({ status: 'declined', declineReason: 'No room for a third caching workshop.' }),
        told: ['Priya Raman', 'Sofia Marchetti'],
        mail: { sent: 2, failed: 0 },
      },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = screen.getByRole('dialog', { name: 'Decline this session?' });
    expect(within(dialog).getByText('Hands-on: Build Caches from Scratch · Latticework Systems')).toBeInTheDocument();
    expect(within(dialog).getByText('Workshop slot')).toBeInTheDocument();
    expect(within(dialog).getByText('Returned to Latticework Systems to use on another session')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Give Latticework Systems a reason. A sponsor never gets a bare decline.');
    expect(postBody(fetchMock, '/ss-ws/decline')).toBeUndefined();

    fireEvent.change(within(dialog).getByLabelText('Reason · sent to Latticework Systems'), {
      target: { value: 'No room for a third caching workshop.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
    expect(await screen.findByText('Declined. Told Priya Raman, Sofia Marchetti.')).toBeInTheDocument();
    expect(postBody(fetchMock, '/ss-ws/decline')).toEqual({ reason: 'No room for a third caching workshop.' });
    expect(screen.queryByRole('dialog', { name: 'Decline this session?' })).not.toBeInTheDocument();
  });

  it('requests changes with a note', async () => {
    const fetchMock = routes({
      [`POST ${SESSION_URL}/request-changes`]: { session: workshop({ status: 'changes_requested' }), told: [], mail: { sent: 0, failed: 0 } },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Request changes' }));
    const dialog = screen.getByRole('dialog', { name: 'Ask Latticework Systems for changes' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send to Latticework Systems' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Say what needs to change.');
    fireEvent.change(within(dialog).getByLabelText('What needs to change · sent to the sponsor contacts'), {
      target: { value: 'Add a takeaway slide.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send to Latticework Systems' }));
    expect(
      await screen.findByText('Changes requested. No contact at Latticework Systems has joined yet, so nobody was emailed.'),
    ).toBeInTheDocument();
    expect(postBody(fetchMock, '/ss-ws/request-changes')).toEqual({ note: 'Add a takeaway slide.' });
  });

  it('states a decision already made instead of offering the actions', async () => {
    routes({
      [`GET ${SESSION_URL}`]: review(
        workshop({ status: 'approved', submissionId: 'sub-9', decidedAt: Date.UTC(YEAR, 7, 2, 12) }),
        [...HISTORY, { id: 'a4', action: 'sponsor_session.approve', actorLabel: 'Jordan Alvarez', createdAt: Date.UTC(YEAR, 7, 2, 12), details: {} }],
      ),
    });
    renderPage();
    expect(await screen.findByText('Approved · 2 Aug')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Submissions' })).toHaveAttribute('href', '/submissions/sub-9');
    expect(screen.getByText('Approved by Jordan Alvarez')).toBeInTheDocument();
    expect(screen.queryByText(/^You asked/)).not.toBeInTheDocument();
  });

  it('says so when the session does not exist', async () => {
    routes({ [`GET ${SESSION_URL}`]: { status: 404, body: errorEnvelope('not_found', 'Sponsor session not found') } });
    renderPage();
    expect(await screen.findByText('Sponsor session not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Sponsor sessions' })).toBeInTheDocument();
  });
});
