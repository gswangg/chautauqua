// Split wave 12 (custodian decomposition of the former single
// PeopleRolesPanel.render.test.tsx): this file covers the per-row
// "Reset password" affordance -- its inline (non-dialog) reveal-once
// password step and its distinct facts/copy vs. the invite reveal.
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

  // DEC-747 amendment (wave 67): the reset-password reveal is a distinct
  // per-row affordance (frame 09--24) that keeps its inline site -- it must
  // not move into a dialog.
  it('keeps the reset-password reveal inline, not inside a dialog', async () => {
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
