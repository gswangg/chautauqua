// Split wave 12 (custodian decomposition of the former single
// PeopleRolesPanel.render.test.tsx): this file covers the row role
// select's optimistic PATCH write and its 409 rollback.
// See PeopleRolesPanel.test-helpers.tsx for shared fixtures.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { errorEnvelope } from '../../test-utils/mockApi';
import { OTHER, SELF, installConsoleErrorGuard, mockPeople, renderPanel } from './PeopleRolesPanel.test-helpers';

installConsoleErrorGuard();

describe('PeopleRolesPanel role change', () => {
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
});
