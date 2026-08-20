// Split wave 12 (custodian decomposition of the former single
// PeopleRolesPanel.render.test.tsx): this file covers the "Invite someone"
// dialog end to end -- open, validation, submit, the reveal-once password
// step, clipboard copy, duplicate-email refusal, and the welcomeEmail
// vocabulary sentences.
// See PeopleRolesPanel.test-helpers.tsx for shared fixtures.
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { errorEnvelope } from '../../test-utils/mockApi';
import { OTHER, SELF, installConsoleErrorGuard, mockPeople, renderPanel } from './PeopleRolesPanel.test-helpers';

installConsoleErrorGuard();

describe('PeopleRolesPanel invite dialog', () => {
  it('shows the created one-time password exactly once and it is not re-fetchable', async () => {
    const fetchMock = mockPeople({
      'POST /api/v1/users': {
        status: 201,
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56', welcomeEmail: 'not_sent_no_event' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);

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

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);

    const reviewerChip = screen.getByRole('radio', { name: 'Reviewer' });
    const organizerChip = screen.getByRole('radio', { name: 'Organizer' });
    expect(reviewerChip).toHaveAttribute('aria-checked', 'true');
    expect(organizerChip).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(organizerChip);
    expect(organizerChip).toHaveAttribute('aria-checked', 'true');
    expect(reviewerChip).toHaveAttribute('aria-checked', 'false');

    expect(
      screen.getByText(
        'A reviewer sees only the plans they are assigned to · an organiser sees everything, including this page',
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
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56', welcomeEmail: 'not_sent_no_event' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
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
    expect(
      screen.getByText(
        'This org has no events yet, so there is nowhere to log the notice and nothing was sent — pass the password on yourself.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Their password · shown once')).toBeInTheDocument();

    const copyButton = screen.getByRole('button', { name: 'Copy the password' });
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
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56', welcomeEmail: 'not_sent_no_event' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    await waitFor(() => {
      expect(screen.getByText('ab12-cd34-ef56')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copy the password' }));
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
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

  // DEC-650 amendment (wave 134), :1360: the rejected-duplicate dialog
  // states its own subtitle line, alongside the field-level refusal above.
  it('swaps the invite dialog subtitle to name the duplicate-email refusal, without dropping the field message', async () => {
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
    expect(screen.getByText('They can sign in as soon as you do this')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Otherton' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Person' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: OTHER.email } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    await screen.findByRole('button', { name: `Open ${OTHER.email}'s row` });
    expect(screen.getByText('The address is already in use')).toBeInTheDocument();
    expect(screen.queryByText('They can sign in as soon as you do this')).not.toBeInTheDocument();
    expect(screen.getByText('A user with this email already exists')).toBeInTheDocument();
  });

  // DEC-238 (wave 65 amendment): the 201 body's welcomeEmail vocabulary
  // drives one sentence per outcome, decided server-side.
  it('names the address the welcome notice was sent to when welcomeEmail is "sent"', async () => {
    mockPeople({
      'POST /api/v1/users': {
        status: 201,
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56', welcomeEmail: 'sent' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    await waitFor(() => {
      expect(screen.getByText('ab12-cd34-ef56')).toBeInTheDocument();
    });
    expect(screen.getByText('A welcome notice was sent to new@example.com.')).toBeInTheDocument();
  });

  it('tells the organizer to pass the password on themselves when welcomeEmail is "not_sent_failed"', async () => {
    mockPeople({
      'POST /api/v1/users': {
        status: 201,
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56', welcomeEmail: 'not_sent_failed' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    await waitFor(() => {
      expect(screen.getByText('ab12-cd34-ef56')).toBeInTheDocument();
    });
    expect(
      screen.getByText('The welcome notice could not be sent — pass the password on yourself.'),
    ).toBeInTheDocument();
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

  // DEC-747 amendment (wave 67): the invite flow is a dialog, not an
  // inline strip (frames 09--18/19/20).
  it('opens a dialog when "Invite someone" is clicked', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('First name')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Last name')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create the account' })).toBeInTheDocument();
  });

  // DEC-747 amendment (wave 67): the created/reveal state is the SAME
  // dialog's second step, not a sibling of the dialog.
  it('renders the created/reveal state inside the same dialog as the invite form', async () => {
    mockPeople({
      'POST /api/v1/users': {
        status: 201,
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56', welcomeEmail: 'not_sent_no_event' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    await waitFor(() => {
      expect(screen.getByText('ab12-cd34-ef56')).toBeInTheDocument();
    });

    // Exactly one dialog, and the reveal is inside it (not a sibling).
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    expect(within(dialogs[0]!).getByText('ab12-cd34-ef56')).toBeInTheDocument();
    // The form step is gone -- this is the dialog's second step, not an
    // additional dialog stacked on top of the form.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();

    // Closing the dialog (Done) is still the last time the password is seen.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('ab12-cd34-ef56')).not.toBeInTheDocument();
  });

  // DEC-919 wave-130 amendment (:1344): the invite reveal's tertiary
  // "Invite someone else" closes the reveal and reopens the same dialog's
  // form step, cleared, without a second copy of the invite-open handler.
  it('reopens the cleared invite form from "Invite someone else" on the reveal step', async () => {
    mockPeople({
      'POST /api/v1/users': {
        status: 201,
        body: { id: 'u-new', email: 'new@example.com', role: 'reviewer', password: 'ab12-cd34-ef56', welcomeEmail: 'not_sent_no_event' },
      },
    });
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Invite someone' })[0]!);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    await waitFor(() => {
      expect(screen.getByText('ab12-cd34-ef56')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invite someone else' }));

    // Still the same dialog, now back on the form step, fields cleared.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('First name')).toHaveValue('');
    expect(within(dialog).getByLabelText('Last name')).toHaveValue('');
    expect(within(dialog).getByLabelText('Email')).toHaveValue('');
    expect(screen.queryByText('ab12-cd34-ef56')).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
