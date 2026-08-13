// DEC-714/DEC-734: AddToEventModal gains a ROLE control offering the app's
// own PARTICIPANT_ROLE_OPTIONS vocabulary (never a hardcoded local list),
// and the chosen role is what POST /contacts/:id/add-to-event sends. The
// old hardcoded explanatory sentence is gone.
//
// DEC-764: the title field starts empty (no `Invited: <name>` prefill),
// 'Add them' is disabled until a title is typed, the dialog states its
// no-email consequence up front, and the success copy names the role
// actually chosen.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AddToEventModal } from './AddToEventModal';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import { PARTICIPANT_ROLE_OPTIONS } from '../../../../src/domain/participant-roles';
import type { ContactListItem } from './types';

const CONTACT: ContactListItem = {
  id: 'ct-1',
  firstName: 'Priya',
  lastName: 'Raman',
  email: 'priya@example.com',
  labels: [],
};

afterEach(() => {
  cleanup();
});

describe('AddToEventModal (DEC-714/DEC-734)', () => {
  it('offers exactly the imported PARTICIPANT_ROLE_OPTIONS vocabulary, defaults to the first option, and states the no-email consequence', async () => {
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'DevFlow Conf 2027' }]),
    });

    render(<AddToEventModal contact={CONTACT} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'DevFlow Conf 2027' })).toBeInTheDocument();
    });

    for (const opt of PARTICIPANT_ROLE_OPTIONS) {
      expect(screen.getByRole('button', { name: opt.label })).toBeInTheDocument();
    }
    const firstOptionButton = screen.getByRole('button', { name: PARTICIPANT_ROLE_OPTIONS[0]!.label });
    expect(firstOptionButton).toHaveAttribute('aria-pressed', 'true');

    // DEC-764: the factual no-email/creates-a-session sentence is present.
    expect(screen.getByText(/creates an accepted session on that event/i)).toBeInTheDocument();
    expect(screen.getByText(/no email is sent/i)).toBeInTheDocument();
  });

  it('starts with no title prefill and disables Add them until a title is typed (DEC-764)', async () => {
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'DevFlow Conf 2027' }]),
    });

    render(<AddToEventModal contact={CONTACT} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'DevFlow Conf 2027' })).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Session title') as HTMLInputElement;
    expect(titleInput.value).toBe('');
    expect(titleInput).not.toHaveValue('Invited: Priya Raman');

    const addButton = screen.getByRole('button', { name: 'Add them' });
    expect(addButton).toBeDisabled();

    fireEvent.change(titleInput, { target: { value: 'Keynote: Priya' } });
    expect(addButton).not.toBeDisabled();

    fireEvent.change(titleInput, { target: { value: '   ' } });
    expect(addButton).toBeDisabled();
  });

  it('sends the chosen role in the POST body and names it in the success copy', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'DevFlow Conf 2027' }]),
      'POST /api/v1/contacts/ct-1/add-to-event': { status: 201, body: { submissionId: 'sub-1' } },
    });

    render(<AddToEventModal contact={CONTACT} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'DevFlow Conf 2027' })).toBeInTheDocument();
    });

    const nonDefault = PARTICIPANT_ROLE_OPTIONS[1]!;
    fireEvent.click(screen.getByRole('button', { name: nonDefault.label }));
    fireEvent.change(screen.getByLabelText('Session title'), { target: { value: 'Panel: Priya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add them' }));

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`accepted ${nonDefault.label.toLowerCase()}`, 'i'))).toBeInTheDocument();
    });

    const call = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : input.toString()).endsWith('/contacts/ct-1/add-to-event'),
    );
    expect(call).toBeDefined();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.role).toBe(nonDefault.value);
    expect(body.title).toBe('Panel: Priya');
  });
});
