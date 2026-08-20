// Split wave 12 (custodian decomposition of the former single
// PeopleRolesPanel.render.test.tsx): this file covers the drilled-in
// directory's static structure -- table/columnheaders, per-row identity
// rendering, scope cells, the phone-only Invite sibling, the self-service
// password-change links, and the two frame consequence sentences.
// See PeopleRolesPanel.test-helpers.tsx for shared fixtures.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OTHER, SELF, installConsoleErrorGuard, mockPeople, renderPanel } from './PeopleRolesPanel.test-helpers';

installConsoleErrorGuard();

describe('PeopleRolesPanel directory structure', () => {
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

  // DEC-781 amendment (v12m-w7-h): the frame draws two distinct
  // consequence sentences for this edit view, not one -- see the dedicated
  // 'DEC-781' block below (row rendering test) for the split (:978 beside
  // the H1, :1003 below the people list).
  it('renders the B10 consequence line', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    expect(
      screen.getByText("You cannot remove or demote yourself · a reviewer's scope limits which tracks they are assigned"),
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

  // DEC-919 wave-99 amendment (task v12m-w2-a): the drill frame draws
  // "Invite someone" a second time as a filled 46px full-width primary
  // below the people list at phone.
  it('renders the control exactly twice once drilled in -- the head link and the phone-only sibling below the list -- both opening the same dialog', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    // docs/design/Chautauqua Settings.dc.html:568
    // `        <span style="display:flex; align-items:center; justify-content:center; margin-top:14px; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; font-size:14px; font-weight:700">Invite someone</span></div>`
    const buttons = screen.getAllByRole('button', { name: 'Invite someone' });
    expect(buttons).toHaveLength(2);

    const [headLink, phoneSibling] = buttons;
    expect(headLink).toHaveClass('chq-settings-section-action');
    expect(phoneSibling).toHaveClass('chq-settings-phone-action');
    expect(phoneSibling).not.toHaveClass('chq-settings-section-action');

    // The phone sibling opens the same invite dialog as the head link.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(phoneSibling!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
  });

  // DEC-919 wave-130 amendment (:1007): the edit view's footer carries a
  // left-flushed link to the self-service password change, reusing
  // SettingsEditForm's existing destructive left slot.
  it('links to self-service password change from the edit view footer', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Change your own password' })).toHaveAttribute(
      'href',
      '/account/password',
    );
  });

  // DEC-781: the frame's two consequence sentences for this edit view have
  // two different homes (Chautauqua Settings.dc.html:978 beside the H1,
  // :1003 below the people list) -- distinct text, distinct places.
  it('renders the frame consequence beside the H1, and the self/scope note below the people list', async () => {
    mockPeople();
    renderPanel(['/settings?section=people&edit=1']);

    await waitFor(() => {
      expect(screen.getByText(SELF.email)).toBeInTheDocument();
    });

    expect(screen.getByText('Only organisers can change roles')).toHaveClass('chq-settings-edit-consequence');
    expect(
      screen.getByText("You cannot remove or demote yourself · a reviewer's scope limits which tracks they are assigned"),
    ).toBeInTheDocument();
  });
});
