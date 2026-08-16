// DEC-662 amendment (wave 55): the Speakers roster's importer link carries
// ?eventId=<id> so the Contacts import wizard preselects that event instead
// of making the organizer re-pick it. An id that doesn't resolve against
// this org's own /events list must fall back to the wizard's normal
// unselected (CRM-only) state -- never a silent switch to a different event.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';

const KNOWN_EVENT_ID = 'evt-known-preselect';
const CURRENT_EVENT_ID = 'evt-currently-selected';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetEventsCacheForTests();
});

function mockContactsPageApi() {
  return mockApi({
    'GET /api/v1/contacts/stats': {
      total: 0,
      speakerCount: 0,
      topCompanies: [],
    },
    'GET /api/v1/segments': listEnvelope([]),
    'GET /api/v1/contacts/duplicates': listEnvelope([]),
    'GET /api/v1/contacts': listEnvelope([]),
    'GET /api/v1/events': listEnvelope([
      { id: KNOWN_EVENT_ID, name: 'Known Conf' },
      { id: CURRENT_EVENT_ID, name: 'Currently Selected Conf' },
    ]),
  });
}

describe('ContactsApp: DEC-662 import wizard event preselect from ?eventId=', () => {
  it('preselects the event named in the URL, distinct from the current-event storage', async () => {
    window.localStorage.setItem('chq.currentEventId', CURRENT_EVENT_ID);
    mockContactsPageApi();

    render(
      <MemoryRouter initialEntries={[`/contacts?import=1&eventId=${KNOWN_EVENT_ID}`]}>
        <ContactsApp />
      </MemoryRouter>,
    );

    // w15-c: the session-title field moved into step 2's match panel (it
    // only renders once eventId is set AND a header row is parsed) --
    // paste CSV text to reach step 2, then find the field.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Choose a file' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), {
      target: { value: 'firstName,lastName,email\nA,B,a@example.com' },
    });

    // DEC-290 (wave-59 amendment): the eventId is a candidate, not an
    // instruction -- the opt-in checkbox names the preselected event, and
    // the session-title field only appears once it is ticked.
    const checkbox = await screen.findByLabelText('Also add these people to Known Conf as accepted speakers');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByLabelText('Session title for this batch')).toBeInTheDocument();
    });
  });

  it('leaves the wizard unselected (never a silent wrong-event default) when the URL id is unknown', async () => {
    window.localStorage.setItem('chq.currentEventId', CURRENT_EVENT_ID);
    mockContactsPageApi();

    render(
      <MemoryRouter initialEntries={['/contacts?import=1&eventId=evt-does-not-exist']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    // w15-c: the dialog's h2 now names the current step ("Choose a file");
    // "Import contacts from CSV" is the ModalFrame subtitle, not a heading.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Choose a file' })).toBeInTheDocument();
    });
    expect(screen.getByText('Import contacts from CSV')).toBeInTheDocument();

    expect(screen.queryByLabelText('Session title for this batch')).not.toBeInTheDocument();
  });
});
