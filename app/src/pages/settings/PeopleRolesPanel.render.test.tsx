// DEC-588 render smoke test: PeopleRolesPanel lists the org's people from
// a mocked API, invites a new one and shows the returned one-time password
// exactly once (reveal-once, matching ApiTokensPanel's pattern), and marks
// the signed-in user's own row as non-actionable.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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

const SELF = { id: 'u-self', email: 'self@example.com', role: 'organizer' };
const OTHER = { id: 'u-other', email: 'other@example.com', role: 'reviewer' };

function mockPeople(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/me': { userId: SELF.id, email: SELF.email, name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([SELF, OTHER]),
    ...extra,
  });
}

describe('PeopleRolesPanel', () => {
  it('renders the rail heading and the list from a mocked API, marking the signed-in row non-actionable', async () => {
    mockPeople();
    render(<PeopleRolesPanel />);

    expect(screen.getByRole('heading', { name: 'People and roles' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });
    expect(screen.getByText(OTHER.email)).toBeInTheDocument();

    // Self row: no reset-password action, just a marker.
    const selfRow = screen.getByText(SELF.email).closest('li')!;
    expect(selfRow).toHaveTextContent('(you)');
    expect(within(selfRow).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument();

    // Other row: the reset action is present.
    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    expect(within(otherRow).getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
  });

  // w15-e/DEC-691: mock's 4-column row (identity, role, scope, Change).
  it('exposes a scope cell per row', async () => {
    mockPeople();
    render(<PeopleRolesPanel />);

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
    render(<PeopleRolesPanel />);

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
    render(<PeopleRolesPanel />);

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
    render(<PeopleRolesPanel />);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
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

    // The only POST /api/v1/users call was the invite itself.
    const postCalls = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(postCalls.length).toBe(1);
  });
});
