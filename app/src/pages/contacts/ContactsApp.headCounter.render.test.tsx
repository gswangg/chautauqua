// task r1-d (src/decisions-data/DEC-919.md): the wordmark row's right-flushed "N of M" counter
// slot has no home on this page -- the wordmark row is the app SHELL's
// header (app/src/styles.css, off limits to this lane) -- so the counter
// lands on this page's own H1 line instead and becomes the head's only
// count. CSS alone decides visibility (desktop hides it, phone shows it);
// the markup renders unconditionally of width once `stats` has settled.
// (contacts.css's own terminal phone block carries the frame citations for
// this counter, verified against docs/design/Chautauqua Contacts.dc.html
// by app/src/frame-citation.scan.test.ts.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-contacts-head-counter';

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  stubPhoneMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('ContactsApp head counter (src/decisions-data/DEC-919.md)', () => {
  it('renders `2 of 318` once the stats envelope settles, at phone width', async () => {
    mockApi({
      'GET /api/v1/contacts/stats': {
        total: 318,
        speakerCount: 40,
        returningSpeakers: 0,
        eventCount: 1,
        topCompanies: [],
      },
      'GET /api/v1/segments': listEnvelope([]),
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope(
        [
          { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', labels: [] },
          { id: 'ct2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', company: 'Navy', labels: [] },
        ],
        { total: 2 },
      ),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    const counter = await screen.findByText('2 of 318');
    expect(counter).toHaveClass('chq-contacts-head-count');
  });

  it('does not render the head-count node before stats has settled', () => {
    // No mockApi call -- fetch never resolves, so `stats` stays null and
    // the {stats && ...} gate must keep the node out of the DOM entirely.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    expect(document.querySelector('.chq-contacts-head-count')).not.toBeInTheDocument();
  });
});
