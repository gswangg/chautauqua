// DEC-805: "Inviting a speaker to the portal is a send, not a pill" — a
// quiet, conditional per-row 'Send portal invite' control on the roster,
// following the same conditional-and-quiet grammar as the existing 'Remind
// <first name>' link: it POSTs one contactId, reports the returned counts,
// and never appears for a contact who already has an account (no use for a
// claim-link invite there).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi } from '../../test-utils/mockApi';
import type { OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-portal-invite-render';

const GRID: OnboardingGridResponse = {
  tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
  rows: [
    {
      // No account yet, not yet invited -- the invite control should render
      // for this row (DEC-934 amendment: the control also gates on
      // not-yet-invited, see OnboardingGrid.render.test.tsx).
      contact: {
        id: 'ct-no-account',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        company: 'Acme',
        hasAccount: false,
        participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'none' }],
      },
      cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
    },
    {
      // Already has an account -- the invite control must NOT render.
      contact: {
        id: 'ct-has-account',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        company: 'Navy',
        hasAccount: true,
        participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-002', title: 'Talk', inviteStatus: 'accepted' }],
      },
      cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
    },
  ],
  total: 2,
  page: 1,
  perPage: 50,
  counts: { speakers: 2, outstandingRequired: 2, overdue: 0, outstandingContacts: 2 },
      timezone: 'UTC',
};

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

describe('OnboardingGrid: per-row "Send portal invite" control (DEC-805)', () => {
  it('renders only for a contact without an account, and reports the send result', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      [`POST /api/v1/events/${EVENT_ID}/portal-invites`]: { sent: 1, skipped: 0, failed: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);

    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    const inviteButtons = table.getAllByRole('button', { name: 'Send portal invite' });
    // Exactly one row (the table view) offers the control -- Grace Hopper
    // (hasAccount: true) never gets one.
    expect(inviteButtons).toHaveLength(1);
    const [inviteButton] = inviteButtons;
    if (!inviteButton) throw new Error("unreachable — inviteButtons has length 1");

    fireEvent.click(inviteButton);

    await waitFor(() => {
      const calledPortalInvite = fetchMock.mock.calls.some(([input]) =>
        String(input).includes(`/api/v1/events/${EVENT_ID}/portal-invites`),
      );
      expect(calledPortalInvite).toBe(true);
    });

    const invitePostCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes(`/api/v1/events/${EVENT_ID}/portal-invites`),
    );
    expect(invitePostCall).toBeDefined();
    const [, init] = invitePostCall as [unknown, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ contactIds: ['ct-no-account'] });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sent to 1 portal invite.'));
  });

  it('names a recipient with no address instead of silently dropping them from the toast', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      [`POST /api/v1/events/${EVENT_ID}/portal-invites`]: {
        sent: 0,
        skipped: 0,
        failed: [{ email: '', message: 'Ada Lovelace has no email address on file' }],
      },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Send portal invite' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Ada Lovelace has no email address on file'),
    );
  });
});

// Eval regression (MAJOR, speaker-management): "'Send portal invite' reports
// success ... but the speaker's participation badge remains 'Not invited'
// after a FULL PAGE RELOAD." DEC-869 made this menu action the ONLY door to
// the 'invited' state ('invited' is not a selectable radio), so the action
// must reach the endpoint that mints it — and the grid must re-read the
// server's answer afterwards rather than leaving a stale badge on screen.
describe('ParticipationMenu action -> POST portal-invites (eval regression)', () => {
  it('sends through the portal-invites endpoint and re-reads the roster', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      [`POST /api/v1/events/${EVENT_ID}/portal-invites`]: { sent: 1, skipped: 0, failed: [] },
    });

    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);

    const gridReadsBefore = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes(`/api/v1/events/${EVENT_ID}/onboarding`),
    ).length;

    const table = within(screen.getByRole('table'));
    const trigger = table.getByRole('button', { name: /^Participation status for Ada Lovelace/ });
    fireEvent.click(trigger);

    const panel = within(screen.getByRole('menu', { name: /^Participation status for Ada Lovelace/ }));
    fireEvent.click(panel.getByRole('menuitem', { name: /Send portal invite/ }));

    await waitFor(() => {
      const invitePost = fetchMock.mock.calls.find(([input]) =>
        String(input).includes(`/api/v1/events/${EVENT_ID}/portal-invites`),
      );
      expect(invitePost).toBeDefined();
      const [, init] = invitePost as [unknown, RequestInit];
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ contactIds: ['ct-no-account'] });
    });

    // The send writes invite_status server-side; the roster re-reads so the
    // badge shows that state without a reload.
    await waitFor(() => {
      const gridReadsAfter = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes(`/api/v1/events/${EVENT_ID}/onboarding`),
      ).length;
      expect(gridReadsAfter).toBeGreaterThan(gridReadsBefore);
    });
  });
});
