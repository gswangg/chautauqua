// DEC-830: "Participation status is a MENU of named states, each stating its
// consequence; the portal invite is an ACTION in that menu, not a state it
// writes." Mounts OnboardingGrid (the menu's real host) and drives the
// roster row's participation control end to end: opening the menu, each of
// the four state items PATCHing the exact body, the fifth action item
// POSTing to /portal-invites and never touching the PATCH endpoint, and the
// menu's consequence caption + footer copy.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi } from '../../test-utils/mockApi';
import type { InviteStatus, OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-participation-menu-render';

function gridWith(inviteStatus: InviteStatus): OnboardingGridResponse {
  return {
    tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
    rows: [
      {
        contact: {
          id: 'ct1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          company: 'Acme',
          hasAccount: false,
          participantId: 'p-ct1',
          submissionId: 'sub-ct1',
          inviteStatus,
        },
        cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null, assignedAt: 0 }],
      },
    ],
    total: 1,
    page: 1,
    perPage: 50,
    counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
  };
}

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

async function openMenu() {
  render(<OnboardingGrid onAddSpeaker={vi.fn()} />);
  await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
  const table = within(screen.getByRole('table'));
  fireEvent.click(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Not invited' }));
  return within(table.getByRole('menu', { name: 'Participation status for Ada Lovelace' }));
}

describe('ParticipationMenu (DEC-830)', () => {
  it.each<[InviteStatus, string]>([
    ['none', 'Not invited'],
    ['invited', 'Invited'],
    ['accepted', 'Confirmed'],
    ['declined', 'Declined'],
  ])('the %s item PATCHes { inviteStatus: %s }', async (status) => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/submissions/sub-ct1/participants/p-ct1': { body: {} },
    });

    const menu = await openMenu();
    const label = { none: 'Not invited', invited: 'Invited', accepted: 'Confirmed', declined: 'Declined' }[status];
    fireEvent.click(menu.getByRole('menuitem', { name: label }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        return url.includes('/submissions/sub-ct1/participants/p-ct1') && init?.method === 'PATCH';
      });
      expect(call).toBeDefined();
      expect(JSON.parse(call![1]!.body as string)).toEqual({ inviteStatus: status });
    });
  });

  it('the "Send portal invite" action item POSTs to /portal-invites and never PATCHes a status', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      [`POST /api/v1/events/${EVENT_ID}/portal-invites`]: { sent: 1, skipped: 0, failed: [] },
    });

    const menu = await openMenu();
    fireEvent.click(menu.getByRole('menuitem', { name: 'Send portal invite' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) =>
        String(input).includes(`/api/v1/events/${EVENT_ID}/portal-invites`),
      );
      expect(call).toBeDefined();
      const [, init] = call as [unknown, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ contactIds: ['ct1'] });
    });

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patchCall).toBeUndefined();
  });

  it('shows the consequence caption and the footer explaining only "Send portal invite" sends anything', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    expect(menu.getByText('Invited and Declined hide this speaker from the public pages and pause their uploads')).toBeInTheDocument();
    expect(
      menu.getByText('Only Send portal invite sends anything — the other three record what you already know'),
    ).toBeInTheDocument();
  });
});
