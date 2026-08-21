// DEC-919 wave-156: the 390 READ drill (no `?edit=1`) renders the frame's
// own footer primary -- Chautauqua Settings.dc.html:568 draws "Invite
// someone" as a filled 46px full-width control below the people list, and
// it must open the SAME invite dialog the edit drill's controls open,
// directly (its own surface, not a form submit). Replaces the assertion
// that used to live only against the design file's bytes
// (settings-phone-390.frames.test.ts:264, "gap: read-drilled view does not
// yet render it") with a real render receipt.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OTHER, SELF, installConsoleErrorGuard, mockPeople, renderPanel } from './PeopleRolesPanel.test-helpers';

installConsoleErrorGuard();

describe('PeopleRolesPanel read drill', () => {
  it('renders the frame\'s "Invite someone" footer primary in the READ drill (no ?edit=1)', async () => {
    mockPeople();
    renderPanel(['/settings?section=people']);

    // OTHER carries no `name`, so the read row's label falls back to its
    // email (SELF's row instead shows its name -- personLabel's fallback).
    await waitFor(() => {
      expect(screen.getByText(OTHER.email)).toBeInTheDocument();
    });

    // The read drill renders the per-person rows plus the frame's own
    // footer primary -- never the edit form's directory table/head link.
    expect(screen.queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument();

    const footerPrimary = screen.getByRole('button', { name: 'Invite someone' });
    expect(footerPrimary).toHaveClass('chq-settings-drillrow-footer-primary');
  });

  it('opens the existing invite dialog directly from the read drill -- never a navigation, never a second dialog', async () => {
    mockPeople();
    renderPanel(['/settings?section=people']);

    await waitFor(() => {
      expect(screen.getByText(OTHER.email)).toBeInTheDocument();
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const footerPrimary = screen.getByRole('button', { name: 'Invite someone' });
    fireEvent.click(footerPrimary);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
    // Still on the read drill -- the dialog is its own surface, not a
    // form submit that would have entered the edit drill.
    expect(screen.queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument();
  });

  it('does not render the footer primary once drilled into the edit view', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    // The edit drill has its own two "Invite someone" controls (head link
    // + phone-action sibling, covered by PeopleRolesPanel.directory.render
    // .test.tsx) -- the read drill's footer primary class is not among
    // them, so exactly one node can ever carry it at a time.
    expect(document.querySelector('.chq-settings-drillrow-footer-primary')).not.toBeInTheDocument();
  });
});
