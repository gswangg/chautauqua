// Settings · Sponsorships (Portals frame, flow 5): mounts the page against a
// mocked GET /sponsorships and drives the tier editor (EditTierModal, with
// the over-allowance preview a lowered count triggers), the sponsor dialog
// and Add sponsor (SponsorModals: package, extras, contacts) through their
// real requests, including the API's refusals.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SponsorshipsPage } from './SponsorshipsPage';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import { resetApiCacheForTests } from '../../lib/api';
import type { SponsorshipDetail, SponsorshipsOverview } from './types';

const EVENT_ID = 'evt-sponsors';
const BASE = `/api/v1/events/${EVENT_ID}`;

function overview(): SponsorshipsOverview {
  return {
    tiers: [
      {
        id: 'tier-gold',
        name: 'Gold',
        position: 0,
        entitlements: [
          { id: 'ent-talk', count: 1, format: 'Talk (30 min)', minutes: 30, extra: false, position: 0 },
          { id: 'ent-ws', count: 2, format: 'Workshop (120 min)', minutes: 120, extra: false, position: 1 },
        ],
        summary: 'One 30-minute talk · two 120-minute workshops',
        sponsors: 2,
      },
      {
        id: 'tier-silver',
        name: 'Silver',
        position: 1,
        entitlements: [{ id: 'ent-silver-talk', count: 1, format: 'Talk (30 min)', minutes: 30, extra: false, position: 0 }],
        summary: 'One 30-minute talk',
        sponsors: 0,
      },
    ],
    sponsors: [
      {
        id: 'sp-lattice',
        companyName: 'Latticework Systems',
        tierId: 'tier-gold',
        tierName: 'Gold',
        status: 'active',
        statusLine: 'Talk — approved · Workshop — changes requested · Workshop — not started',
        contacts: 3,
        waiting: 0,
        extras: [],
      },
      {
        id: 'sp-riverbed',
        companyName: 'Riverbed',
        tierId: 'tier-gold',
        tierName: 'Gold',
        status: 'active',
        statusLine: 'Talk — awaiting approval · Workshop — not started · Workshop — not started',
        contacts: 2,
        waiting: 1,
        extras: [],
      },
      {
        id: 'sp-northwind',
        companyName: 'Northwind Data',
        tierId: 'tier-silver',
        tierName: 'Silver',
        status: 'pending',
        statusLine: 'Talk — approved · package fully used',
        contacts: 1,
        waiting: 0,
        extras: [],
      },
    ],
    waiting: 2,
    formats: ['Talk (30 min)', 'Workshop (120 min)', 'Booth demo'],
  };
}

function riverbed(): SponsorshipDetail {
  return {
    sponsorship: { id: 'sp-riverbed', companyName: 'Riverbed', tierId: 'tier-gold', status: 'active' },
    contacts: [
      { id: 'sc-hannah', contactId: 'c-hannah', name: 'Hannah Okafor', email: 'hannah@riverbed.example', status: 'joined', isPrimary: true, invitedAt: null, joinedAt: Date.UTC(2026, 8, 1, 12) },
      { id: 'sc-tomas', contactId: 'c-tomas', name: 'Tomas Bell', email: 'tomas@riverbed.example', status: 'invited', isPrimary: false, invitedAt: Date.UTC(2026, 8, 3, 12), joinedAt: null },
    ],
    entitlements: [
      { id: 'ent-talk', count: 1, format: 'Talk (30 min)', minutes: 30, extra: false },
      { id: 'ent-ws', count: 2, format: 'Workshop (120 min)', minutes: 120, extra: false },
    ],
    slots: [
      { entitlementId: 'ent-talk', format: 'Talk (30 min)', minutes: 30, extra: false, session: { id: 'ss-flags', entitlementId: 'ent-talk', title: 'Shipping Feature Flags Without the Debt', status: 'submitted' } },
      { entitlementId: 'ent-ws', format: 'Workshop (120 min)', minutes: 120, extra: false, session: null },
      { entitlementId: 'ent-ws', format: 'Workshop (120 min)', minutes: 120, extra: false, session: null },
    ],
    over: [{ id: 'ss-old', entitlementId: 'ent-gone', title: 'An Older Talk', status: 'approved' }],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings/sponsorships']}>
      <Routes>
        <Route path="/settings/sponsorships" element={<SponsorshipsPage />} />
        <Route path="/speakers/sponsor-sessions" element={<p>the queue</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function routes(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/events': listEnvelope([{ id: EVENT_ID, name: 'DevFlow Conf 2027' }]),
    [`GET ${BASE}/sponsorships`]: overview(),
    ...extra,
  });
}

function bodyOf(fetchMock: ReturnType<typeof mockApi>, method: string, path: string): unknown {
  const call = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith(path) && (init?.method ?? 'GET') === method);
  if (!call) throw new Error(`no ${method} ${path} call`);
  return JSON.parse(String(call[1]?.body ?? 'null'));
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

describe('SponsorshipsPage', () => {
  it('lists tiers and sponsors, with the queue link and the package-fully-used emphasis', async () => {
    routes();
    renderPage();
    await screen.findByText('One 30-minute talk · two 120-minute workshops');
    // SettingsSubPage draws the H1 and its in-content twin
    expect(screen.getAllByRole('heading', { name: 'Sponsorships', level: 1 }).length).toBeGreaterThan(0);
    const tiers = screen.getByRole('table', { name: 'Tiers' });
    expect(within(tiers).getByText('Gold')).toBeInTheDocument();
    expect(within(tiers).getByRole('button', { name: 'Edit Silver' })).toBeInTheDocument();

    const sponsors = screen.getByRole('table', { name: 'Sponsors' });
    expect(within(sponsors).getByRole('button', { name: 'Latticework Systems' })).toBeInTheDocument();
    expect(within(sponsors).getByText('package fully used').tagName).toBe('STRONG');
    // a pending sponsorship is marked; an active one isn't
    expect(within(sponsors).getAllByText('Pending')).toHaveLength(1);
    // Riverbed has one session waiting: its row links to the queue
    expect(within(sponsors).getByRole('link', { name: '1 waiting for approval' })).toHaveAttribute('href', '/speakers/sponsor-sessions');
    expect(screen.getByRole('link', { name: '2 sessions waiting for approval' })).toHaveAttribute('href', '/speakers/sponsor-sessions');
  });

  it('previews who would go over when a count is lowered, then saves the tier', async () => {
    const fetchMock = routes({
      [`POST ${BASE}/sponsor-tiers/tier-gold/preview`]: {
        over: [{ sponsorshipId: 'sp-lattice', companyName: 'Latticework Systems', sessions: [{ id: 'ss-ws', title: 'Hands-on: Build Caches from Scratch', status: 'changes_requested' }] }],
      },
      [`PUT ${BASE}/sponsor-tiers/tier-gold`]: { ok: true },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Gold' }));
    const dialog = screen.getByRole('dialog', { name: 'Gold' });
    expect(within(dialog).getByText('Each Gold sponsor can create')).toBeInTheDocument();
    // a format that states its length sets it: no length control for it
    expect(within(dialog).getByText('30 min')).toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox', { name: 'Row 1 length' })).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Row 2 count' }), { target: { value: '1' } });
    expect(await within(dialog).findByText('Over the new allowance')).toBeInTheDocument();
    expect(within(dialog).getByText(/Hands-on: Build Caches from Scratch \(changes requested\)/)).toBeInTheDocument();
    expect(within(dialog).getByText('Saving keeps these sessions. Approved sessions are never removed.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/sponsor-tiers/tier-gold/preview')).toEqual({
      entitlements: [
        { id: 'ent-talk', count: 1, format: 'Talk (30 min)', minutes: 30 },
        { id: 'ent-ws', count: 1, format: 'Workshop (120 min)', minutes: 120 },
      ],
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Gold saved.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'PUT', '/sponsor-tiers/tier-gold')).toEqual({
      name: 'Gold',
      entitlements: [
        { id: 'ent-talk', count: 1, format: 'Talk (30 min)', minutes: 30 },
        { id: 'ent-ws', count: 1, format: 'Workshop (120 min)', minutes: 120 },
      ],
    });
    expect(screen.queryByRole('dialog', { name: 'Gold' })).not.toBeInTheDocument();
  });

  it('creates a tier, offering a length only for a format with none', async () => {
    const fetchMock = routes({ [`POST ${BASE}/sponsor-tiers`]: { status: 201, body: { id: 'tier-new' } } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'New tier' }));
    const dialog = screen.getByRole('dialog', { name: 'New tier' });
    fireEvent.change(within(dialog).getByLabelText('Tier name'), { target: { value: 'Bronze' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Row 1 session type' }), { target: { value: 'Booth demo' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Row 1 length' }), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Bronze added.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/sponsor-tiers')).toEqual({
      name: 'Bronze',
      entitlements: [{ count: 1, format: 'Booth demo', minutes: 15 }],
    });
  });

  it("shows the API's refusal when a tier still in use is deleted", async () => {
    routes({
      [`DELETE ${BASE}/sponsor-tiers/tier-gold`]: {
        status: 409,
        body: errorEnvelope('conflict', "Move this tier's sponsors to another tier before deleting it."),
      },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Gold' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Gold' })).getByRole('button', { name: 'Delete tier' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete the Gold tier?' })).getByRole('button', { name: 'Delete tier' }));
    expect(await screen.findByText("Move this tier's sponsors to another tier before deleting it.")).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Gold' })).toBeInTheDocument();
  });

  it('opens a sponsor: its package, what is over the allowance, and an extra saved through PATCH', async () => {
    const fetchMock = routes({
      [`GET ${BASE}/sponsorships/sp-riverbed`]: riverbed(),
      [`PATCH ${BASE}/sponsorships/sp-riverbed`]: { ok: true },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Riverbed' }));
    const dialog = screen.getByRole('dialog', { name: 'Riverbed' });
    expect(await within(dialog).findByText('Shipping Feature Flags Without the Debt · awaiting approval')).toBeInTheDocument();
    expect(within(dialog).getByText('Gold · 2 contacts')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Workshop · 120 min')).toHaveLength(2);
    expect(within(dialog).getByText('Reserved')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Free')).toHaveLength(2);
    expect(within(dialog).getByText('Over the allowance')).toBeInTheDocument();
    expect(within(dialog).getByText('An Older Talk (approved)')).toBeInTheDocument();

    // nothing changed yet: Save waits
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    // one more talk for Riverbed
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add a session type' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Riverbed saved.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'PATCH', '/sponsorships/sp-riverbed')).toEqual({
      extras: [{ count: 1, format: 'Talk (30 min)', minutes: 30 }],
    });
  });

  it('changes a sponsor’s tier and status in one PATCH', async () => {
    const fetchMock = routes({
      [`GET ${BASE}/sponsorships/sp-riverbed`]: riverbed(),
      [`PATCH ${BASE}/sponsorships/sp-riverbed`]: { ok: true },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Riverbed' }));
    const dialog = screen.getByRole('dialog', { name: 'Riverbed' });
    fireEvent.change(await within(dialog).findByLabelText('Tier'), { target: { value: 'tier-silver' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pending' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText('Riverbed saved.');
    expect(bodyOf(fetchMock, 'PATCH', '/sponsorships/sp-riverbed')).toEqual({ tierId: 'tier-silver', status: 'pending' });
  });

  it('adds and removes sponsor contacts, and shows a refusal', async () => {
    const fetchMock = routes({
      [`GET ${BASE}/sponsorships/sp-riverbed`]: riverbed(),
      [`POST ${BASE}/sponsorships/sp-riverbed/contacts`]: { status: 201, body: { sponsorContactId: 'sc-ana', contactId: 'c-ana', created: true } },
      [`DELETE ${BASE}/sponsorships/sp-riverbed/contacts/sc-tomas`]: {
        status: 400,
        body: errorEnvelope('invalid', "The primary contact can't be removed. Make someone else primary first."),
      },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Riverbed' }));
    const dialog = screen.getByRole('dialog', { name: 'Riverbed' });
    expect(await within(dialog).findByText('Hannah Okafor')).toBeInTheDocument();
    expect(within(dialog).getByText('Primary')).toBeInTheDocument();
    expect(within(dialog).getByText(/tomas@riverbed\.example · Invited 3 Sep · not joined yet/)).toBeInTheDocument();
    // the primary contact offers no Remove
    expect(within(dialog).queryByRole('button', { name: 'Remove Hannah Okafor' })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    fireEvent.change(within(dialog).getByLabelText('First name'), { target: { value: 'Ana' } });
    fireEvent.change(within(dialog).getByLabelText(/^Last name/), { target: { value: 'Ruiz' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'ana@riverbed.example' } });
    fireEvent.click(within(dialog).getByLabelText('Make them the primary contact'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    expect(await within(dialog).findByText('Ana Ruiz added.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/sponsorships/sp-riverbed/contacts')).toEqual({
      firstName: 'Ana',
      lastName: 'Ruiz',
      email: 'ana@riverbed.example',
      primary: true,
    });

    // the server's refusal is shown as it words it
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Tomas Bell' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove Tomas Bell from Riverbed?' })).getByRole('button', { name: 'Remove contact' }));
    expect(await within(dialog).findByText("The primary contact can't be removed. Make someone else primary first.")).toBeInTheDocument();
  });

  it('adds a sponsor with a first contact', async () => {
    const fetchMock = routes({ [`POST ${BASE}/sponsorships`]: { status: 201, body: { id: 'sp-new' } } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add sponsor' }));
    const dialog = screen.getByRole('dialog', { name: 'Add sponsor' });
    // the company name is required
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add sponsor' }));
    expect(await within(dialog).findByText('Enter the company name.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Company'), { target: { value: 'Cloudreach Labs' } });
    fireEvent.change(within(dialog).getByLabelText('Tier'), { target: { value: 'tier-silver' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pending' }));
    fireEvent.change(within(dialog).getByLabelText('First name'), { target: { value: 'Mina' } });
    fireEvent.change(within(dialog).getByLabelText(/^Last name/), { target: { value: 'Park' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'mina@cloudreach.example' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add sponsor' }));
    expect(await screen.findByText('Cloudreach Labs added.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/sponsorships')).toEqual({
      companyName: 'Cloudreach Labs',
      tierId: 'tier-silver',
      status: 'pending',
      contact: { firstName: 'Mina', lastName: 'Park', email: 'mina@cloudreach.example' },
    });
  });

  it('shows the empty states', async () => {
    routes({ [`GET ${BASE}/sponsorships`]: { tiers: [], sponsors: [], waiting: 0, formats: [] } });
    renderPage();
    expect(await screen.findByText('No tiers yet')).toBeInTheDocument();
    expect(screen.getByText('No sponsors yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /waiting for approval/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add sponsor' })).toBeInTheDocument());
  });
});
