// Split wave 12 (custodian decomposition of the former single
// PeopleRolesPanel.render.test.tsx): this file covers the per-row
// "Reset password" affordance -- its reveal-once password step and its
// distinct facts/copy vs. the invite reveal. DEC-747 (wave-7 amendment):
// the reveal now renders as a Modal, the same dialog contract the invite
// reveal already uses.
// See PeopleRolesPanel.test-helpers.tsx for shared fixtures.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OTHER, SELF, installConsoleErrorGuard, mockPeople, renderPanel } from './PeopleRolesPanel.test-helpers';

installConsoleErrorGuard();

describe('PeopleRolesPanel reset password', () => {
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
    expect(screen.getByText('New password · shown once')).toBeInTheDocument();
    expect(
      screen.getByText(`Every session signed in as ${OTHER.email} is ended — they are signed out everywhere.`),
    ).toBeInTheDocument();
    expect(screen.getByText('Resetting sends no email; pass the new password on yourself.')).toBeInTheDocument();
    // The reset path never states one of the invite path's welcomeEmail sentences.
    expect(
      screen.queryByText(/This org has no events yet, so there is nowhere to log the notice/),
    ).not.toBeInTheDocument();
    // DEC-919 wave-130 amendment (:1497): the reset reveal draws Done alone
    // -- no "Invite someone else" tertiary.
    expect(screen.queryByRole('button', { name: 'Invite someone else' })).not.toBeInTheDocument();
    // DEC-650 amendment (wave 134), :1495: the reset reveal's own, shorter
    // closing note beside Copy the password -- never the invite reveal's
    // longer "dialog ... reset can replace it" sentence.
    expect(screen.getByText('Closing this is the last time you see it')).toBeInTheDocument();
    expect(
      screen.queryByText('Closing this dialog is the last time you see it — after that only a reset can replace it.'),
    ).not.toBeInTheDocument();
  });

  // DEC-747 (wave-7 amendment): the reset-password reveal is a Modal, the
  // same dialog contract the invite reveal already uses (Chautauqua
  // Settings.dc.html:1477-1484) -- title names the person, subtitle is
  // 'email · Role', a Close control in the head.
  it('renders the reset-password reveal as a Modal with the frame anatomy', async () => {
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
    const dialog = screen.getByRole('dialog');
    // OTHER carries no `name`, so the title falls back to its email --
    // same fallback shape as the invite reveal and the row list.
    expect(within(dialog).getByText(`${OTHER.email} can sign in again`)).toBeInTheDocument();
    expect(within(dialog).getByText(`${OTHER.email} · Reviewer`)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    // Its own modalClassName -- never the invite dialog's.
    expect(dialog.querySelector('.chq-modal')).toHaveClass('chq-people-reset-modal');
    expect(dialog.querySelector('.chq-modal')).not.toHaveClass('chq-people-invite-modal');
  });

  it('closes the reset reveal dialog via its Close control', async () => {
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

    let dialog!: HTMLElement;
    await waitFor(() => {
      dialog = screen.getByRole('dialog');
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('zz99-yy88-xx77')).not.toBeInTheDocument();
  });
});
