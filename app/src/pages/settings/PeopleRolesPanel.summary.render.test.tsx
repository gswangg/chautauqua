// DEC-588 render smoke test, updated w6-e/DEC-815: PeopleRolesPanel is now
// a read-only summary (SummarySection) -- people/organizer/reviewer
// counts -- until the 'Change' action drills into (?section=people&edit=1)
// the full directory.
//
// Split wave 12 (custodian decomposition of the former single
// PeopleRolesPanel.render.test.tsx): this file covers the rest-state
// summary, the drill-in transition, and the self-row role-select guard.
// See PeopleRolesPanel.test-helpers.tsx for shared fixtures.
import { describe, expect, it } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OTHER, SELF, installConsoleErrorGuard, mockPeople, renderPanel } from './PeopleRolesPanel.test-helpers';
import { listEnvelope } from '../../test-utils/mockApi';

installConsoleErrorGuard();

describe('PeopleRolesPanel summary/drill-in', () => {
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
    // G13: both the disabled select AND the disabled-not-hidden Remove
    // (frame 09--14/B10) carry the self-protection reason.
    for (const guarded of within(selfRow).getAllByTitle('You cannot remove or demote yourself')) {
      expect(guarded).toBeDisabled();
    }
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
    expect(within(selfRow).getAllByTitle('You cannot remove or demote yourself').length).toBeGreaterThan(0);

    const otherRow = screen.getByText(OTHER.email).closest('li')!;
    expect(within(otherRow).getByRole('combobox', { name: `Role for ${OTHER.email}` })).not.toBeDisabled();
  });
});
