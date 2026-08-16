// DEC-830: "Participation status is a MENU of named states, each stating its
// consequence; the portal invite is an ACTION in that menu, not a state it
// writes." Mounts OnboardingGrid (the menu's real host) and drives the
// roster row's participation control end to end: opening the menu, each of
// the four state items PATCHing the exact body, the fifth action item
// POSTing to /portal-invites and never touching the PATCH endpoint, and the
// menu's consequence caption + footer copy.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi } from '../../test-utils/mockApi';
import { INVITE_STATUSES, INVITE_STATUS_LABELS, type InviteStatus, type OnboardingGridResponse } from './types';
import { PARTICIPATION_STATE_CAPTIONS } from './ParticipationMenu';

// DEC-869 (wave-9 amendment): jsdom does not resolve stylesheet cascade, so
// the "in force" tint and the right-flushed NOW chip are pinned by reading
// the stylesheet text directly, following the extractRule style already
// used by the repo's CSS scan tests (e.g. test/auth-card-geometry.test.ts).
const SPEAKERS_CSS = readFileSync(join(__dirname, 'speakers.css'), 'utf8');

function extractRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const match = css.match(re);
  expect(match, `expected to find rule for selector: ${selector}`).not.toBeNull();
  return match![1]!;
}

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
          participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus }],
        },
        cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
      },
    ],
    total: 1,
    page: 1,
    perPage: 50,
    counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
      timezone: 'UTC',
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
  render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
  await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
  const table = within(screen.getByRole('table'));
  fireEvent.click(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Not invited' }));
  return within(table.getByRole('menu', { name: 'Participation status for Ada Lovelace' }));
}

describe('ParticipationMenu (DEC-830)', () => {
  // DEC-869 (wave-50 amendment): the menu offers exactly three SELECTABLE
  // states -- 'invited' is never one of them; Send portal invite occupies
  // that slot as an action.
  it.each<[InviteStatus, string]>([
    ['none', 'Not invited'],
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
    fireEvent.click(menu.getByRole('menuitemradio', { name: new RegExp(`^${label}`) }));

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
    fireEvent.click(menu.getByRole('menuitem', { name: /^Send portal invite/ }));

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

  it('shows the footer explaining only "Send portal invite" sends anything', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    expect(
      menu.getByText('Only Send portal invite sends anything — the other two record what you already know'),
    ).toBeInTheDocument();
  });

  // DEC-869 (wave-50 amendment): "Send portal invite" occupies the Invited
  // slot -- the menu never offers a fourth, activatable radio named
  // 'Invited'.
  it('offers exactly three activatable menuitemradios and never one named "Invited"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    const radios = menu.getAllByRole('menuitemradio');
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(radio).not.toBeDisabled();
    }
    expect(menu.queryByRole('menuitemradio', { name: /^Invited/ })).not.toBeInTheDocument();
  });

  // DEC-869 (wave-50 amendment): when the participation IS currently
  // 'invited', that row still renders so the organiser can see where they
  // are -- same anatomy, aria-checked, NOW marker -- but it is disabled/
  // non-activatable; only "Send portal invite" can act on it.
  it('renders the current-state "Invited" row disabled with the NOW marker, and it never fires onSelectStatus', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('invited'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    render(<MemoryRouter><OnboardingGrid onAddSpeaker={vi.fn()} /></MemoryRouter>);
    await waitFor(() => screen.getAllByText('Ada Lovelace').length > 0);
    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Invited' }));
    const menu = within(table.getByRole('menu', { name: 'Participation status for Ada Lovelace' }));

    const invitedRow = menu.getByRole('menuitemradio', { name: /^Invited/ });
    expect(invitedRow).toBeDisabled();
    expect(invitedRow).toHaveAttribute('aria-checked', 'true');
    expect(within(invitedRow).getByText('NOW')).toBeInTheDocument();

    fireEvent.click(invitedRow);
    expect(screen.queryByRole('menu')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);

    const radios = menu.getAllByRole('menuitemradio');
    expect(radios).toHaveLength(4);
    expect(radios.filter((r) => !r.hasAttribute('disabled'))).toHaveLength(3);
  });

  it('names the speaker in an identity header above the state items', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    expect(menu.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  // Amendment (wave 48)/DEC-694: the v6 frame's header line names company +
  // portal-account state below the bare name -- 'no portal account' when
  // the contact has none, 'has account' when they do.
  it('renders the company + no-portal-account line under the name when the contact has no account', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    expect(menu.getByText('Acme · no portal account')).toBeInTheDocument();
  });

  it('renders the company + has-account line under the name when the contact already has an account', async () => {
    const withAccount: OnboardingGridResponse = gridWith('none');
    withAccount.rows[0]!.contact.hasAccount = true;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: withAccount,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    expect(menu.getByText('Acme · has account')).toBeInTheDocument();
  });

  it.each(INVITE_STATUSES.filter((candidate) => candidate !== 'invited'))(
    'the %s item is a menuitemradio rendering its Record caption',
    async (candidate) => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
      const item = menu.getByRole('menuitemradio', { name: new RegExp(INVITE_STATUS_LABELS[candidate]) });
      expect(item).toBeInTheDocument();
      expect(within(item).getByText(PARTICIPATION_STATE_CAPTIONS[candidate])).toBeInTheDocument();
    },
  );

  it('marks exactly one item as checked (the current state) and gives it the NOW badge', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    const radios = menu.getAllByRole('menuitemradio');
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    const [current] = checked;
    expect(within(current!).getByText('NOW')).toBeInTheDocument();
    expect(current).toHaveAccessibleName(new RegExp(INVITE_STATUS_LABELS.none));
  });

  // DEC-969: ParticipationMenu's menu adopts the shared useMenu primitive --
  // an outside pointerdown dismisses it, ArrowDown moves focus to the next
  // item, and Escape returns focus to the trigger.
  it('DEC-969: a pointerdown on the document body closes the open menu', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    await openMenu();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('DEC-969: ArrowDown moves focus to the next item', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    const items = menu.getAllByRole('menuitemradio');
    const [first, second] = items;
    expect(first).toHaveFocus();
    const menuPanel = screen.getByRole('menu', { name: 'Participation status for Ada Lovelace' });

    fireEvent.keyDown(menuPanel, { key: 'ArrowDown' });

    expect(second).toHaveFocus();
  });

  it('DEC-969: Escape returns focus to the trigger', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    await openMenu();
    const table = within(screen.getByRole('table'));
    const trigger = table.getByRole('button', { name: 'Participation status for Ada Lovelace: Not invited' });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: 'Participation status for Ada Lovelace' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('the "Send portal invite" action item is not a menuitemradio', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    const action = menu.getByRole('menuitem', { name: /^Send portal invite/ });
    expect(action).not.toHaveAttribute('role', 'menuitemradio');
    expect(action.getAttribute('aria-checked')).toBeNull();
  });

  // Wave-19 (frame :296-317): the action row gets the same two-line anatomy
  // as the state rows -- a label line plus a detail line naming its
  // consequence, not a bare "Send portal invite" label.
  it('renders the "Send portal invite" action row with its consequence as a detail line', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: gridWith('none'),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });
    const menu = await openMenu();
    const action = menu.getByRole('menuitem', { name: /^Send portal invite/ });
    expect(within(action).getByText('Send portal invite')).toBeInTheDocument();
    expect(within(action).getByText('Emails a claim link and sets this to Invited')).toBeInTheDocument();
  });

  // DEC-869 (wave-9 amendment): the state IN FORCE gets a tint distinct from
  // the panel surface AND the :hover background, so hovering a non-current
  // row can never read as more "in force" than the current one.
  it('DEC-869: .is-current sets a background distinct from :hover', () => {
    const hoverRule = extractRule(SPEAKERS_CSS, '.chq-participation-menu-item:hover');
    const currentRule = extractRule(SPEAKERS_CSS, '.chq-participation-menu-item.is-current');
    const hoverBg = hoverRule.match(/background:\s*([^;]+);/)?.[1]?.trim();
    const currentBg = currentRule.match(/background:\s*([^;]+);/)?.[1]?.trim();
    expect(currentBg).toBeDefined();
    expect(hoverBg).toBeDefined();
    expect(currentBg).not.toBe(hoverBg);
  });

  // DEC-869 (wave-9 amendment): the NOW chip is the label row's last flex
  // child pushed to the right edge of the ~260px panel via margin-left:auto,
  // not sitting inline right after the label text.
  it('DEC-869: the NOW chip is right-flushed with margin-left: auto', () => {
    const nowRule = extractRule(SPEAKERS_CSS, '.chq-participation-menu-now');
    expect(nowRule).toMatch(/margin-left:\s*auto/);
  });

  // Wave-19 (DEC-830 amendment, frame :296): the panel is a fixed 420px
  // card, not an auto-sized min-width:260px list.
  it('DEC-830 wave-19: the panel is a fixed 420px width', () => {
    const panelRule = extractRule(SPEAKERS_CSS, '.chq-participation-menu-panel');
    expect(panelRule).toMatch(/width:\s*420px/);
  });

  // Wave-19 (DEC-730 amendment, frame :80): the grid's task-column title is
  // 12px/700, not the earlier 15px override.
  it('DEC-730 wave-19: the task-column title is 12px', () => {
    const titleRule = extractRule(SPEAKERS_CSS, '.chq-speakers-task-title');
    expect(titleRule).toMatch(/font-size:\s*12px/);
  });
});
