// The sponsor-session queue (Portals frame, flow 5): mounts the page
// against a mocked GET /sponsor-sessions and asserts the three groups
// (waiting, back with the sponsor, decided), the rows' copy, the empty
// state, and the inline Approve and Request changes (SponsorDecisionModals),
// including the API's refusal.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SponsorSessionsPage } from './SponsorSessionsPage';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import { resetApiCacheForTests } from '../../lib/api';
import type { SponsorDecisionResult, SponsorSessionDetail, SponsorSessionQueue } from './types';

const EVENT_ID = 'evt-queue';
const BASE = `/api/v1/events/${EVENT_ID}`;
const HOUR = 60 * 60 * 1000;
const YEAR = new Date().getUTCFullYear();

function session(overrides: Partial<SponsorSessionDetail> & Pick<SponsorSessionDetail, 'id' | 'title'>): SponsorSessionDetail {
  return {
    sponsorshipId: 'sp-lattice',
    eventId: EVENT_ID,
    companyName: 'Latticework Systems',
    tierName: 'Gold',
    entitlementId: 'ent-ws',
    slotLabel: 'Workshop · 120 min',
    format: 'Workshop (120 min)',
    minutes: 120,
    abstract: null,
    status: 'submitted',
    lastNote: null,
    lastNoteAt: null,
    lastNoteBy: null,
    declineReason: null,
    submissionId: null,
    submittedAt: Date.now() - HOUR,
    submitCount: 1,
    decidedAt: null,
    createdAt: Date.now() - 100 * HOUR,
    speakers: [],
    slots: [],
    ...overrides,
  };
}

const WORKSHOP = session({
  id: 'ss-ws',
  title: 'Hands-on: Build Caches from Scratch',
  submitCount: 2,
  lastNote: 'Drop the pricing slide.',
  lastNoteAt: Date.now() - 72 * HOUR,
  speakers: [
    { id: 'sss-1', contactId: 'c-priya', name: 'Priya Raman', email: 'priya@example.com', isNew: false },
    { id: 'sss-2', contactId: 'c-ana', name: 'Ana Ruiz', email: 'ana@example.com', isNew: true },
  ],
});

const FLAGS = session({
  id: 'ss-flags',
  title: 'Shipping Feature Flags Without the Debt',
  sponsorshipId: 'sp-riverbed',
  companyName: 'Riverbed',
  entitlementId: 'ent-talk',
  slotLabel: 'Talk · 30 min',
  format: 'Talk (30 min)',
  minutes: 30,
  submittedAt: Date.now() - 50 * HOUR,
  speakers: [{ id: 'sss-3', contactId: 'c-tomas', name: 'Tomas Bell', email: 'tomas@example.com', isNew: false }],
});

function queue(): SponsorSessionQueue {
  return {
    waiting: [FLAGS, WORKSHOP],
    withSponsor: [
      session({
        id: 'ss-booth',
        title: 'Booth Talk',
        companyName: 'Cloudreach Labs',
        tierName: 'Silver',
        status: 'changes_requested',
        lastNote: 'Shorter, please.',
        lastNoteAt: Date.UTC(YEAR, 3, 14, 12),
      }),
    ],
    decided: [
      session({
        id: 'ss-retrieval',
        title: 'Retrieval That Survives a Rewrite',
        companyName: 'Northwind Data',
        tierName: 'Silver',
        format: 'Talk (30 min)',
        minutes: 30,
        status: 'approved',
        decidedAt: Date.UTC(YEAR, 7, 2, 12),
        speakers: [{ id: 'sss-4', contactId: 'c-wei', name: 'Wei Chen', email: 'wei@example.com', isNew: false }],
      }),
      session({ id: 'ss-pitch', title: 'Our Product, Live', status: 'declined', decidedAt: Date.UTC(YEAR, 6, 30, 12) }),
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/speakers/sponsor-sessions']}>
      <Routes>
        <Route path="/speakers/sponsor-sessions" element={<SponsorSessionsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function routes(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/events': listEnvelope([{ id: EVENT_ID, name: 'DevFlow Conf 2027' }]),
    [`GET ${BASE}`]: { id: EVENT_ID, name: 'DevFlow Conf 2027', timezone: 'UTC' },
    [`GET ${BASE}/sponsor-sessions`]: queue(),
    ...extra,
  });
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

describe('SponsorSessionsPage', () => {
  it('groups the queue: waiting, with the sponsor, decided', async () => {
    routes();
    renderPage();
    expect(await screen.findByText('Waiting · 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sponsor sessions' })).toBeInTheDocument();
    expect(screen.getByText('2 waiting')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Speakers' })).toHaveAttribute('href', '/speakers');

    const waiting = screen.getByRole('region', { name: 'Waiting · 2' });
    expect(within(waiting).getByText('Riverbed · Gold')).toBeInTheDocument();
    expect(within(waiting).getByText('Talk, 30 min')).toBeInTheDocument();
    expect(within(waiting).getByText('Tomas Bell · submitted 2 days ago')).toBeInTheDocument();
    expect(within(waiting).getByText('Workshop, 120 min')).toBeInTheDocument();
    expect(within(waiting).getByText('Priya Raman, Ana Ruiz (new) · resubmitted today')).toBeInTheDocument();
    expect(within(waiting).getByRole('link', { name: 'Hands-on: Build Caches from Scratch' })).toHaveAttribute(
      'href',
      '/speakers/sponsor-sessions/ss-ws',
    );
    expect(within(waiting).getAllByRole('button', { name: /^Approve / })).toHaveLength(2);

    const withSponsor = screen.getByRole('region', { name: 'With the sponsor · 1' });
    expect(within(withSponsor).getByText('Changes requested 14 Apr')).toBeInTheDocument();
    expect(within(withSponsor).queryByRole('button', { name: /^Approve/ })).not.toBeInTheDocument();

    const decided = screen.getByRole('region', { name: 'Decided' });
    expect(within(decided).getByText('Approved 2 Aug')).toBeInTheDocument();
    expect(within(decided).getByText('Not accepted 30 Jul')).toBeInTheDocument();
  });

  it('says so when no sponsor has sent anything', async () => {
    routes({ [`GET ${BASE}/sponsor-sessions`]: { waiting: [], withSponsor: [], decided: [] } });
    renderPage();
    expect(await screen.findByText('No sponsor sessions yet')).toBeInTheDocument();
    expect(screen.getByText('0 waiting')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sponsorships' })).toHaveAttribute('href', '/settings/sponsorships');
  });

  it('keeps the waiting group when it is empty but others are not', async () => {
    const q = queue();
    routes({ [`GET ${BASE}/sponsor-sessions`]: { ...q, waiting: [] } });
    renderPage();
    expect(await screen.findByText('Nothing waiting for approval')).toBeInTheDocument();
    expect(screen.getByText('Waiting · 0')).toBeInTheDocument();
  });

  it('approves inline and shows what happened', async () => {
    const result: SponsorDecisionResult = {
      session: { ...WORKSHOP, status: 'approved', submissionId: 'sub-1' },
      submissionId: 'sub-1',
      invited: ['Ana Ruiz'],
      told: ['Priya Raman', 'Sofia Marchetti'],
      mail: { told: { sent: 2, failed: 0 }, invited: { sent: 1, failed: 0 } },
    };
    const fetchMock = routes({ [`POST ${BASE}/sponsor-sessions/ss-ws/approve`]: result });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve Hands-on: Build Caches from Scratch' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approved' });
    expect(within(dialog).getByText('Added to the program')).toBeInTheDocument();
    expect(within(dialog).getByText('Accepted · Workshop · needs a slot in Agenda')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Open in Agenda' })).toHaveAttribute('href', '/agenda');
    expect(within(dialog).getByText('Ana Ruiz invited')).toBeInTheDocument();
    expect(within(dialog).getByText('Latticework Systems told')).toBeInTheDocument();
    expect(within(dialog).getByText('Priya Raman, Sofia Marchetti')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/ss-ws/approve') && init?.method === 'POST')).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to the queue' }));
    expect(screen.queryByRole('dialog', { name: 'Approved' })).not.toBeInTheDocument();
  });

  it('shows the refusal when a session was already decided elsewhere', async () => {
    routes({
      [`POST ${BASE}/sponsor-sessions/ss-flags/approve`]: {
        status: 409,
        body: errorEnvelope('conflict', "This session isn't waiting for a decision."),
      },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve Shipping Feature Flags Without the Debt' }));
    expect(await screen.findByText("This session isn't waiting for a decision.")).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Approved' })).not.toBeInTheDocument();
  });

  it('requests changes from the queue and says who was told', async () => {
    const fetchMock = routes({
      [`POST ${BASE}/sponsor-sessions/ss-flags/request-changes`]: {
        session: { ...FLAGS, status: 'changes_requested' },
        told: ['Hannah Okafor', 'Tomas Bell'],
        mail: { sent: 1, failed: 1 },
      },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Request changes to Shipping Feature Flags Without the Debt' }));
    const dialog = screen.getByRole('dialog', { name: 'Ask Riverbed for changes' });
    fireEvent.change(within(dialog).getByLabelText('What needs to change · sent to the sponsor contacts'), {
      target: { value: 'Name the clean-up tooling.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send to Riverbed' }));
    expect(await screen.findByText('Changes requested. Told Hannah Okafor, Tomas Bell · 1 email didn\'t send.')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/ss-flags/request-changes'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ note: 'Name the clean-up tooling.' });
  });
});
