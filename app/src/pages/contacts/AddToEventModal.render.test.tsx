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
import { MemoryRouter } from 'react-router-dom';
import { AddToEventModal } from './AddToEventModal';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import { PARTICIPANT_ROLE_OPTIONS } from '../../../../src/domain/participant-roles';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import type { ContactDetail, ContactListItem } from './types';

const CONTACT: ContactListItem = {
  id: 'ct-1',
  firstName: 'Priya',
  lastName: 'Raman',
  email: 'priya@example.com',
  labels: [],
};

function detailWithSubmissions(submissions: ContactDetail['history']['submissions']): ContactDetail {
  return {
    ...CONTACT,
    socialLinks: { twitter: '', linkedin: '', github: '', website: '' },
    customFields: {},
    history: { submissions, submissionsTotal: submissions.length, emails: [], emailsTotal: 0, events: [], eventsTotal: 0 },
  };
}

const NO_HISTORY = detailWithSubmissions([]);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  // useCurrentEvent's loadEventsOnce cache is scoped to one page load and
  // must be reset between tests in the same file (see its own doc comment)
  // -- without this a later test's background reconcile pass can resolve
  // against an EARLIER test's stale /events response and silently move the
  // selection back off the id this test just asserted.
  resetEventsCacheForTests();
});

describe('AddToEventModal (DEC-714/DEC-734)', () => {
  it('offers exactly the imported PARTICIPANT_ROLE_OPTIONS vocabulary, defaults to the first option, and states the no-email consequence', async () => {
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'DevFlow Conf 2027' }]),
      'GET /api/v1/contacts/ct-1': NO_HISTORY,
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'DevFlow Conf 2027' })).toBeInTheDocument();
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
      'GET /api/v1/contacts/ct-1': NO_HISTORY,
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'DevFlow Conf 2027' })).toBeInTheDocument();
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
      'GET /api/v1/contacts/ct-1': NO_HISTORY,
      'POST /api/v1/contacts/ct-1/add-to-event': { status: 201, body: { submissionId: 'sub-1' } },
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'DevFlow Conf 2027' })).toBeInTheDocument();
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

  // DEC-829 (wave-59 amendment): the success link must carry the selected
  // target event id so /speakers resolves to that event, not whatever
  // event happens to be current -- ?eventId is the first step of the SPA's
  // current-event resolution order (app/src/lib/useCurrentEvent.ts).
  it('the "View in Speakers" success link carries the selected event id', async () => {
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'DevFlow Conf 2027' }]),
      'GET /api/v1/contacts/ct-1': NO_HISTORY,
      'POST /api/v1/contacts/ct-1/add-to-event': { status: 201, body: { submissionId: 'sub-1' } },
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'DevFlow Conf 2027' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Session title'), { target: { value: 'Keynote: Priya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add them' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'View in Speakers' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'View in Speakers' })).toHaveAttribute('href', '/speakers?eventId=ev-1');
  });
});

describe('AddToEventModal defaults to the event in context (DEC-795)', () => {
  it('defaults the Event select to the current event when it appears in the returned list', async () => {
    window.localStorage.setItem('chq.currentEventId', 'ev-2');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'DevFlow Conf 2027' },
        { id: 'ev-2', name: 'Forward Summit 2028' },
      ]),
      'GET /api/v1/contacts/ct-1': NO_HISTORY,
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Forward Summit 2028' })).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('button', { name: 'DevFlow Conf 2027' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('falls back to the first event when the current event id is not in the returned list', async () => {
    window.localStorage.setItem('chq.currentEventId', 'ev-not-in-list');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'DevFlow Conf 2027' },
        { id: 'ev-2', name: 'Forward Summit 2028' },
      ]),
      'GET /api/v1/contacts/ct-1': NO_HISTORY,
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'DevFlow Conf 2027' })).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('button', { name: 'Forward Summit 2028' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('AddToEventModal advisory when the contact already has a submission on the selected event (DEC-795)', () => {
  it('shows a named advisory and relabels the primary action when a submission already exists on the selected event', async () => {
    window.localStorage.setItem('chq.currentEventId', 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'DevFlow Conf 2027' }]),
      'GET /api/v1/contacts/ct-1': detailWithSubmissions([
        { id: 'sub-1', ref: 'SUB-1', title: 'Keynote', eventId: 'ev-1', eventName: 'DevFlow Conf 2027', status: 'accepted' },
        { id: 'sub-2', ref: 'SUB-2', title: 'Panel', eventId: 'ev-1', eventName: 'DevFlow Conf 2027', status: 'accepted' },
      ]),
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Priya Raman is already on this event.*2 sessions/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Add another session' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add them' })).not.toBeInTheDocument();
    // Never blocked: the primary action stays enabled once a title exists.
    fireEvent.change(screen.getByLabelText('Session title'), { target: { value: 'Second talk' } });
    expect(screen.getByRole('button', { name: 'Add another session' })).not.toBeDisabled();
  });

  it('shows no advisory when the contact has no submission on the selected event', async () => {
    window.localStorage.setItem('chq.currentEventId', 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'DevFlow Conf 2027' }]),
      'GET /api/v1/contacts/ct-1': NO_HISTORY,
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'DevFlow Conf 2027' })).toBeInTheDocument();
    });
    expect(screen.queryByText(/already on this event/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add them' })).toBeInTheDocument();
  });

  it('re-evaluates the advisory when the Event select changes', async () => {
    window.localStorage.setItem('chq.currentEventId', 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'DevFlow Conf 2027' },
        { id: 'ev-2', name: 'Forward Summit 2028' },
      ]),
      'GET /api/v1/contacts/ct-1': detailWithSubmissions([
        { id: 'sub-1', ref: 'SUB-1', title: 'Keynote', eventId: 'ev-1', eventName: 'DevFlow Conf 2027', status: 'accepted' },
      ]),
    });

    render(
      <MemoryRouter>
        <AddToEventModal contact={CONTACT} onClose={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/already on this event.*1 session/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Forward Summit 2028' }));

    await waitFor(() => {
      expect(screen.queryByText(/already on this event/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Add them' })).toBeInTheDocument();
  });
});
