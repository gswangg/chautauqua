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
  it('renders the real rows (name + role) at rest, with no directory controls before edit', async () => {
    mockPeople();
    renderPanel();

    const section = await screen.findByRole('region', { name: 'People and roles' });
    expect(within(section).getByRole('heading', { name: 'People and roles' })).toBeInTheDocument();

    await waitFor(() => {
      expect(within(section).getByText(SELF.name)).toBeInTheDocument();
    });
    expect(within(section).getByText('Organizer')).toBeInTheDocument();
    expect(within(section).getByText(OTHER.email)).toBeInTheDocument();
    expect(within(section).getByText('Reviewer')).toBeInTheDocument();

    expect(within(section).queryByRole('button', { name: 'Invite someone' })).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  // DEC-910: a speaker holding a portal account must be reported with its
  // own real role -- never absorbed into "reviewer" by a negated predicate.
  it('reports each person by their own role, not a negated "organizer" predicate (DEC-910)', async () => {
    const SPEAKER_1 = { id: 'u-speaker-1', email: 'speaker1@example.com', role: 'speaker' };
    mockPeople({ 'GET /api/v1/users': listEnvelope([SELF, OTHER, SPEAKER_1]) });
    renderPanel();

    const section = await screen.findByRole('region', { name: 'People and roles' });
    await waitFor(() => {
      expect(within(section).getByText(SPEAKER_1.email)).toBeInTheDocument();
    });

    const speakerRow = within(section).getByText(SPEAKER_1.email).closest('.chq-settings-row') as HTMLElement;
    expect(within(speakerRow).getByText('Speaker')).toBeInTheDocument();
    expect(within(speakerRow).queryByText('Reviewer')).not.toBeInTheDocument();
  });

  it('drills into the directory via Change, marking the signed-in row non-actionable', async () => {
    mockPeople();
    renderPanel();

    const section = await screen.findByRole('region', { name: 'People and roles' });
    await waitFor(() => {
      expect(within(section).getByText(SELF.name)).toBeInTheDocument();
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });
    expect(screen.getByText(OTHER.email)).toBeInTheDocument();

    const selfRow = screen.getByText(SELF.email).closest('li')!;
    expect(within(selfRow).getByRole('combobox', { name: `Role for ${SELF.email}` })).toBeDisabled();
    // User-filed (gate-9): the in-row guard sentence broke the row grid —
    // the reason now lives on the disabled select's title and the screen's
    // consequence line, and the row keeps one action.
    expect(within(selfRow).getByTitle('You cannot remove or demote yourself')).toBeDisabled();
    expect(within(selfRow).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument();

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    expect(within(otherRow).getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
  });

  // DEC-896/B10: the role control is disabled (not hidden) on your own row,
  // and the reason is readable inline, not just a title tooltip.
  it('disables the role select on your own row, with the reason readable on the row', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const selfRow = screen.getByText(SELF.email).closest('li')!;
    const roleSelect = within(selfRow).getByRole('combobox', { name: `Role for ${SELF.email}` });
    expect(roleSelect).toBeDisabled();
    expect(within(selfRow).getByTitle('You cannot remove or demote yourself')).toBeInTheDocument();

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    expect(within(otherRow).getByRole('combobox', { name: `Role for ${OTHER.email}` })).not.toBeDisabled();
  });

  // w5-e/DEC-691 amendment: PERSON / ROLE / SCOPE header row over the row grid.
  it('renders the PERSON / ROLE / SCOPE column header row once drilled in', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: 'Person' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Role' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Scope' })).toBeInTheDocument();
  });

  // w5-e/DEC-691 amendment: the role cell IS the select at rest -- no prior
  // click needed to reach it.
  // DEC-930 wave-22 amendment: the header row + row grid are wrapped in a
  // role=table so the previously-orphaned role=row header is valid ARIA,
  // and the columnheaders are reachable from inside that table.
  it('wraps the header and rows in a table with reachable columnheaders (DEC-930)', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const table = screen.getByRole('table', { name: 'People and roles' });
    expect(within(table).getByRole('columnheader', { name: 'Person' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Role' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Scope' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header row + 2 people rows
  });

  it("renders each row's role control as a select without any prior click", async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    const roleSelect = within(otherRow).getByRole('combobox', { name: `Role for ${OTHER.email}` });
    expect(roleSelect).toHaveValue('reviewer');
    // No click required to reach the control -- the old click-to-edit
    // 'Change' role button no longer exists on the row.
    expect(within(otherRow).queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  // A22: the self-service password-change link now lives beside your own
  // row instead of at the top of the Settings page.
  it('carries the change-your-own-password link beside your own row', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const selfRow = screen.getByText(SELF.email).closest('li')!;
    expect(within(selfRow).getByRole('link', { name: 'Change password' })).toHaveAttribute(
      'href',
      '/account/password',
    );
  });

  it('renders the B10 consequence line', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    expect(
      screen.getByText("You cannot remove or demote yourself. A reviewer's scope limits which tracks they are assigned."),
    ).toBeInTheDocument();
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

  // DEC-778, w5-e/DEC-691 amendment: the row's select IS the role control --
  // changing it commits (optimistically) and PATCHes immediately.
  it('changes a role via the row select, writing optimistically then confirming via PATCH', async () => {
    mockPeople({
      'PATCH /api/v1/users/u-other': { status: 200, body: { id: OTHER.id, email: OTHER.email, role: 'organizer' } },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    const roleSelect = within(otherRow).getByRole('combobox', { name: `Role for ${OTHER.email}` });

    fireEvent.change(roleSelect, { target: { value: 'organizer' } });

    // Optimistic: the select reflects the new value immediately, before the
    // PATCH resolves.
    expect(roleSelect).toHaveValue('organizer');

    await waitFor(() => {
      expect(roleSelect).not.toBeDisabled();
    });
    expect(roleSelect).toHaveValue('organizer');
  });

  // DEC-778, w5-e/DEC-691 amendment: a 409 (last organizer / self-service
  // refusal) rolls the optimistic write back and surfaces the reason inline
  // on the row rather than a panel-wide banner.
  it('rolls back the optimistic role write and surfaces a 409 refusal inline on the row', async () => {
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
    const roleSelect = within(otherRow).getByRole('combobox', { name: `Role for ${OTHER.email}` });

    fireEvent.change(roleSelect, { target: { value: 'organizer' } });

    await waitFor(() => {
      expect(within(otherRow).getByText("Cannot remove the organization's last organizer")).toBeInTheDocument();
    });
    // Loud rollback: the select is back to the server-confirmed role, not
    // left showing the rejected optimistic value.
    expect(roleSelect).toHaveValue('reviewer');
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
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

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
    const sendButton = screen.getByRole('button', { name: 'Create the account' });
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

  // DEC-747 amendment (wave 58), item 1: the verb matches the act -- there
  // is no invitation, the account is created immediately.
  it('names the primary "Create the account" and states the account is created immediately', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));

    expect(screen.queryByRole('button', { name: 'Send invitation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Invite$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create the account' })).toBeInTheDocument();
    expect(
      screen.getByText(/nobody waits for an acceptance that will never come/),
    ).toBeInTheDocument();
  });

  // DEC-747 amendment (wave 58), item 2: role is two chips with the
  // consequence spelled out.
  it('renders the role field as two chips naming each role\'s consequence', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));

    const reviewerChip = screen.getByRole('radio', { name: 'Reviewer' });
    const organizerChip = screen.getByRole('radio', { name: 'Organizer' });
    expect(reviewerChip).toHaveAttribute('aria-checked', 'true');
    expect(organizerChip).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(organizerChip);
    expect(organizerChip).toHaveAttribute('aria-checked', 'true');
    expect(reviewerChip).toHaveAttribute('aria-checked', 'false');

    expect(
      screen.getByText(
        'a reviewer sees only the plans they are assigned to · an organiser sees everything, including this page',
      ),
    ).toBeInTheDocument();
  });

  // DEC-747 amendment (wave 58), items 3 + 4: the created screen carries a
  // 20px-monospace password, a Copy control that reports success/failure,
  // the closing sentence and the honest email_log gap.
  it('reveals the created password with a reporting Copy control, the closing note and the email gap', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mockPeople({
      'POST /api/v1/users': {
        status: 201,
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    await waitFor(() => {
      expect(screen.getByText('ab12-cd34-ef56')).toBeInTheDocument();
    });
    expect(screen.getByText('ab12-cd34-ef56')).toHaveClass('chq-settings-people-password');

    expect(
      screen.getByText(
        'Closing this dialog is the last time you see it — after that only a reset can replace it.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/an org with no events yet gets a working account and no email/)).toBeInTheDocument();

    const copyButton = screen.getByRole('button', { name: 'Copy' });
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Copied');
    });
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('reports a failed clipboard copy rather than failing silently', async () => {
    vi.stubGlobal('navigator', {});
    mockPeople({
      'POST /api/v1/users': {
        status: 201,
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    await waitFor(() => {
      expect(screen.getByText('ab12-cd34-ef56')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Copy failed');
    });
    expect(screen.getByLabelText('One-time password to copy manually')).toHaveValue('ab12-cd34-ef56');
  });

  // DEC-747 amendment (wave 58), item 5: a rejected duplicate offers a
  // route to the existing row rather than making the organizer retype.
  it('offers a route to the existing row when the invite is a duplicate email', async () => {
    mockPeople({
      'POST /api/v1/users': {
        status: 409,
        body: errorEnvelope('conflict', 'A user with this email already exists', { email: 'already in use' }),
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Otherton' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Person' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: OTHER.email } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    const openRowButton = await screen.findByRole('button', { name: `Open ${OTHER.email}'s row` });
    fireEvent.click(openRowButton);

    // Clicking the escape route closes the invite form and focuses the
    // existing row.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    expect(otherRow).toHaveFocus();
  });

  // DEC-747 amendment (wave 58), item 6: reset uses the same reveal-once
  // shape and states the two facts unique to it.
  it('reveals a reset password with the session-revocation and no-email facts', async () => {
    mockPeople({
      'POST /api/v1/users/u-other/reset-password': {
        status: 200,
        body: { email: OTHER.email, password: 'zz99-yy88-xx77' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    fireEvent.click(within(otherRow).getByRole('button', { name: 'Reset password' }));
    fireEvent.click(within(otherRow).getByRole('button', { name: 'Confirm reset' }));

    await waitFor(() => {
      expect(screen.getByText('zz99-yy88-xx77')).toBeInTheDocument();
    });
    expect(screen.getByText('zz99-yy88-xx77')).toHaveClass('chq-settings-people-password');
    expect(
      screen.getByText(`Every session signed in as ${OTHER.email} is ended — they are signed out everywhere.`),
    ).toBeInTheDocument();
    expect(screen.getByText('Resetting sends no email; pass the new password on yourself.')).toBeInTheDocument();
    // The reset path never states the invite path's email_log gap.
    expect(screen.queryByText(/an org with no events yet gets a working account/)).not.toBeInTheDocument();
  });

  it('does not build a pending-invitation state', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    expect(screen.queryByText('Invited')).not.toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
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
