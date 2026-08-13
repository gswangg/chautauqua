// DEC-588 render smoke test, updated w6-e/DEC-815: PeopleRolesPanel is now
// a read-only summary (SummarySection) -- people/organizer/reviewer
// counts -- until the 'Change' action drills into (?section=people&edit=1)
// the full directory (invite, reveal-once one-time password on
// invite/reset, per-row inline role change, reset password).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { PeopleRolesPanel } from './PeopleRolesPanel';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
  cleanup();
});

const SELF = { id: 'u-self', email: 'self@example.com', role: 'organizer', name: 'Selma Fields' };
// OTHER deliberately carries no `name` -- a pre-w35-c legacy row -- so tests
// can assert the email fallback still reads correctly.
const OTHER = { id: 'u-other', email: 'other@example.com', role: 'reviewer' };

function mockPeople(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/me': { userId: SELF.id, email: SELF.email, name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([SELF, OTHER]),
    ...extra,
  });
}

function renderPanel(initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PeopleRolesPanel />
    </MemoryRouter>,
  );
}

describe('PeopleRolesPanel', () => {
  it('renders a read-only summary of people/organizer/reviewer counts, with no directory before edit', async () => {
    mockPeople();
    renderPanel();

    const section = await screen.findByRole('region', { name: 'People and roles' });
    expect(within(section).getByRole('heading', { name: 'People and roles' })).toBeInTheDocument();

    await waitFor(() => {
      expect(within(section).getByText('2 people')).toBeInTheDocument();
    });
    // 1 organizer (SELF), 1 reviewer (OTHER).
    expect(within(section).getAllByText('1')).toHaveLength(2);

    expect(within(section).queryByText(SELF.email)).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Invite someone' })).not.toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  // DEC-910: a speaker holding a portal account must not be counted (and
  // printed, with the per-track-scoping hint) as a reviewer. This fails
  // against the old `u.role !== 'organizer'` predicate, which would report
  // Reviewers 3 (1 real reviewer + 2 speakers) instead of Reviewers 1.
  it('counts each role by grouping, not by negating "organizer" (DEC-910)', async () => {
    const SPEAKER_1 = { id: 'u-speaker-1', email: 'speaker1@example.com', role: 'speaker' };
    const SPEAKER_2 = { id: 'u-speaker-2', email: 'speaker2@example.com', role: 'speaker' };
    mockPeople({ 'GET /api/v1/users': listEnvelope([SELF, OTHER, SPEAKER_1, SPEAKER_2]) });
    renderPanel();

    const section = await screen.findByRole('region', { name: 'People and roles' });
    await waitFor(() => {
      expect(within(section).getByText('4 people')).toBeInTheDocument();
    });

    expect(within(section).getByText('Organizers')).toBeInTheDocument();

    // Organisers 1, Reviewers 1 -- the two speakers must not inflate the
    // reviewer count.
    const reviewersLabel = within(section).getByText('Reviewers');
    const reviewersRow = reviewersLabel.closest('.chq-settings-row') as HTMLElement;
    expect(within(reviewersRow).getByText('1')).toBeInTheDocument();

    const organizersLabel = within(section).getByText('Organizers');
    const organizersRow = organizersLabel.closest('.chq-settings-row') as HTMLElement;
    expect(within(organizersRow).getByText('1')).toBeInTheDocument();
  });

  it('drills into the directory via Change, marking the signed-in row non-actionable', async () => {
    mockPeople();
    renderPanel();

    const section = await screen.findByRole('region', { name: 'People and roles' });
    await waitFor(() => {
      expect(within(section).getByText('2 people')).toBeInTheDocument();
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });
    expect(screen.getByText(OTHER.email)).toBeInTheDocument();
    // The section-level 'Change' drill action is gone once editing; the
    // two remaining 'Change' buttons are the per-row inline role controls.
    expect(within(section).getAllByRole('button', { name: 'Change' })).toHaveLength(2);

    const selfRow = screen.getByText(SELF.email).closest('li')!;
    expect(selfRow).toHaveTextContent('(you)');
    expect(within(selfRow).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument();

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    expect(within(otherRow).getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
  });

  // w15-e/DEC-691: mock's 4-column row (identity, role, scope, Change).
  it('exposes a scope cell per row, once drilled in', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const scopeCells = screen.getAllByTestId('people-scope');
    expect(scopeCells).toHaveLength(2);
    scopeCells.forEach((cell) => expect(cell).toHaveTextContent('All events in this org'));
  });

  // DEC-778: Change becomes a real inline role control that PATCHes and
  // refreshes the list.
  it('changes a role via the inline Change control and refreshes the list', async () => {
    mockPeople({
      'PATCH /api/v1/users/u-other': { status: 200, body: { id: OTHER.id, email: OTHER.email, role: 'organizer' } },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    fireEvent.click(within(otherRow).getByRole('button', { name: 'Change' }));

    fireEvent.change(within(otherRow).getByLabelText(`New role for ${OTHER.email}`), {
      target: { value: 'organizer' },
    });
    fireEvent.click(within(otherRow).getByRole('button', { name: 'Save role' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save role' })).not.toBeInTheDocument();
    });
  });

  // DEC-778: a 409 (last organizer / self-service refusal) surfaces inline
  // on the row rather than a panel-wide banner.
  it('surfaces a 409 role-change refusal inline on the row', async () => {
    mockPeople({
      'PATCH /api/v1/users/u-other': {
        status: 409,
        body: errorEnvelope('conflict', "Cannot remove the organization's last organizer"),
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    fireEvent.click(within(otherRow).getByRole('button', { name: 'Change' }));
    fireEvent.click(within(otherRow).getByRole('button', { name: 'Save role' }));

    await waitFor(() => {
      expect(within(otherRow).getByText("Cannot remove the organization's last organizer")).toBeInTheDocument();
    });
    // The role editor stays open on failure -- Change still says "Save role".
    expect(within(otherRow).getByRole('button', { name: 'Save role' })).toBeInTheDocument();
  });

  it('shows the created one-time password exactly once and it is not re-fetchable', async () => {
    const fetchMock = mockPeople({
      'POST /api/v1/users': { status: 201, body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56' } },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => {
      expect(screen.getByText('ab12-cd34-ef56')).toBeInTheDocument();
    });
    expect(screen.getByText(/copy it now, it will not be shown again/)).toBeInTheDocument();

    // Dismissing the reveal clears it from the DOM — the password is never
    // persisted client-side and there's no endpoint to re-fetch it.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('ab12-cd34-ef56')).not.toBeInTheDocument();

    // The only POST /api/v1/users call was the invite itself, and it carried
    // firstName/lastName alongside email/role (w35-e wire contract).
    const postCalls = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(postCalls.length).toBe(1);
    const body = JSON.parse((postCalls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ email: 'new@example.com', role: 'reviewer', firstName: 'Nadia', lastName: 'Okafor' });
  });

  // w35-e/DEC-757: a teammate account is a named person -- both name inputs
  // are required, matching the panel's existing affordance grammar (submit
  // stays disabled until every required field is non-blank).
  it('requires both first and last name before Send invite is enabled', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    const sendButton = screen.getByRole('button', { name: 'Send invite' });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    expect(sendButton).not.toBeDisabled();

    // Blanking the last name back out disables submit again.
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: '   ' } });
    expect(sendButton).toBeDisabled();
  });

  it('leads each directory row with the person\'s name, dropping email to a secondary line', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.name)).toBeInTheDocument();
    });

    // SELF has a name -- the row's primary text is the name, not the bare
    // address, while the email still renders as a quiet secondary line.
    const selfRow = screen.getByText(SELF.name).closest('li')!;
    expect(within(selfRow).getByText(SELF.email)).toBeInTheDocument();

    // OTHER is a nameless legacy row (no `name` on the wire payload) -- it
    // still reads correctly via the email fallback.
    expect(screen.getByText(OTHER.email)).toBeInTheDocument();
  });
});
