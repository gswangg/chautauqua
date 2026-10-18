// DEC-505: a refusal reaches the person who caused it. The person record's
// mutating parts -- PersonRecordEventRoles (add/remove an event role) and
// PersonRecordModals (reopen an item, invite to speak) -- mounted on their
// own against the API's real refusal envelopes, each message asserted in
// the DOM: a fields-map refusal on the field it names, anything else at
// the top of its own surface.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { EventRolesSection } from './PersonRecordEventRoles';
import { InviteToSpeakModal, ReopenModal } from './PersonRecordModals';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { ViewItemJson } from './types';
import type { SubmissionListItem } from '../submissions/types';

const EVENT_ID = 'evt-refusals';
const CONTACT_ID = 'ct-1';

const CLOSED: ViewItemJson = {
  key: 'task-release|p:pa-1',
  kind: 'general',
  title: 'Speaker release',
  taskId: 'task-release',
  assignmentId: 'as-release',

  state: 'closed',
  required: true,
  dueDay: Date.UTC(2027, 2, 20),
  graceDays: 0,
  completedAt: null,
  portals: [{ id: 'po-cfp', name: 'CFP speakers' }],
  direct: false,
  merge: null,
  detached: false,
  statusLine: null,
  statusWord: null,
  openUntil: null,
};

const SESSION: SubmissionListItem = {
  id: 'sub-50',
  ref: 'DFC-050',
  title: 'Platform day',
  status: 'accepted',
  contentStatus: 'pending',
  speakers: [],
  trackIds: [],
  submittedAt: null,
  createdAt: 0,
  slot: null,
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe('PersonRecordEventRoles refusals', () => {
  it('shows an add refusal and a remove refusal in the section', async () => {
    mockApi({
      [`POST /api/v1/events/${EVENT_ID}/event-roles`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Role must be one of volunteer, press, host, staff.', { role: 'Invalid value' }),
      },
      [`DELETE /api/v1/events/${EVENT_ID}/event-roles/er-1`]: { status: 404, body: errorEnvelope('not_found', 'Role not found') },
    });
    const onChanged = vi.fn();
    render(
      <EventRolesSection
        eventId={EVENT_ID}
        contactId={CONTACT_ID}
        firstName="Priya"
        roles={[{ id: 'er-1', contactId: CONTACT_ID, role: 'press', roleLabel: 'Press', name: 'Priya Raman', email: 'p@example.com' }]}
        onChanged={onChanged}
      />,
    );
    fireEvent.change(screen.getByLabelText('Role to add'), { target: { value: 'volunteer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a role' }));
    expect(await screen.findByText('Role must be one of volunteer, press, host, staff.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Press' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove role' }));
    expect(await screen.findByText('Role not found')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('PersonRecordModals refusals', () => {
  it('ReopenModal puts a date refusal on the date and anything else above it', async () => {
    let refusal = errorEnvelope('invalid', 'until must be a date (YYYY-MM-DD)', { until: 'Invalid date' });
    let status = 400;
    mockApi({
      [`POST /api/v1/events/${EVENT_ID}/people/${CONTACT_ID}/reopen`]: () => ({ status, body: refusal }),
    });
    const onReopened = vi.fn();
    render(<ReopenModal eventId={EVENT_ID} contactId={CONTACT_ID} firstName="Priya" item={CLOSED} onClose={() => {}} onReopened={onReopened} />);
    const dialog = screen.getByRole('dialog', { name: 'Reopen Speaker release' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reopen' }));
    const fieldError = await within(dialog).findByRole('alert');
    expect(fieldError).toHaveTextContent('until must be a date (YYYY-MM-DD)');

    refusal = errorEnvelope('not_found', 'Item not found');
    status = 404;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reopen' }));
    expect(await within(dialog).findByText('Item not found')).toHaveClass('chq-error');
    expect(onReopened).not.toHaveBeenCalled();
  });

  it('InviteToSpeakModal puts a reply-by refusal on that field and a conflict above the form', async () => {
    let refusal = errorEnvelope('invalid', 'Reply-by must be a real date.', { replyBy: 'Invalid date' });
    let status = 400;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([SESSION]),
      [`POST /api/v1/events/${EVENT_ID}/invitations`]: () => ({ status, body: refusal }),
    });
    const onSent = vi.fn();
    render(
      <MemoryRouter>
        <InviteToSpeakModal eventId={EVENT_ID} contactId={CONTACT_ID} name="Priya Raman" onSessionIds={new Set()} onClose={() => {}} onSent={onSent} />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Invite to speak' });
    const select = within(dialog).getByLabelText('Session');
    await within(select).findByRole('option', { name: 'DFC-050 Platform day' });
    fireEvent.change(select, { target: { value: 'sub-50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    const replyByError = await within(dialog).findByRole('alert');
    expect(replyByError).toHaveTextContent('Reply-by must be a real date.');
    expect(replyByError.closest('.chq-form-row')).toHaveTextContent('Reply by');

    refusal = errorEnvelope('invalid', 'This session already has as many participants as it can.');
    status = 400;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    expect(await within(dialog).findByText('This session already has as many participants as it can.')).toHaveClass('chq-error');
    expect(onSent).not.toHaveBeenCalled();
  });
});
