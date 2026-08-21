// src/decisions-data/DEC-919.md (task r1-e): the DirectoryRail stands down at 390 -- the frame's
// phone body is the scrolling headerless card list alone, with no rail
// beneath it. That stand-down is legal only under src/decisions-data/DEC-919.md's carve-out ("a
// hidden control
// with no offset is still on the screen" -- a section can go display:none
// ONLY if every capability it carried has a surviving full-screen path
// already on this page). This file is the measured half of that receipt:
// it mounts the real ContactsApp with a stubbed phone matchMedia and
// asserts the two surviving paths (`Segments · N` and `Duplicates · N`)
// are actually present in the document at 390, rather than trusting the
// claim in contacts.css's comment or DirectoryRail.tsx's header comment.
//
// contacts.css's own `.chq-contacts-rail { display: none }` rule is a CSS
// TEXT assertion, covered separately in contacts-rail-390.test.ts --
// jsdom applies no stylesheet and evaluates no @media rule, so this file
// cannot itself prove the rail is visually hidden; it proves the two
// escape hatches exist, which is the part a stylesheet-only scan cannot.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import type { ContactListItem, DuplicateGroup, Segment } from './types';

const EVENT_ID = 'evt-contacts-rail-390';

const CONTACTS: ContactListItem[] = [
  { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', title: 'Engineer', submissionCount: 2, labels: [] },
];

const DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    contactIds: ['ct3', 'ct4'],
    reason: 'name_and_company',
    contacts: [
      { id: 'ct3', firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@acme.example', company: 'Acme', createdAt: 1000 },
      { id: 'ct4', firstName: 'Sam', lastName: 'Rivera', email: 'sam.r@acmecorp.example', company: 'Acme', createdAt: 1000 },
    ],
  },
];

const SEGMENTS: Segment[] = [
  { id: 'seg1', name: 'VIP speakers', rules: [{ field: 'company', op: 'eq', value: 'Acme' }], count: 1 },
];

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function baseRoutes() {
  return {
    'GET /api/v1/contacts/stats': {
      total: 1,
      speakerCount: 1,
      topCompanies: [{ company: 'Acme', count: 1 }],
    },
    'GET /api/v1/segments': listEnvelope(SEGMENTS),
    'GET /api/v1/contacts': listEnvelope(CONTACTS),
    'GET /api/v1/contacts/duplicates': listEnvelope(DUPLICATE_GROUPS, { total: DUPLICATE_GROUPS.length }),
    'GET /api/v1/events': listEnvelope([{ id: EVENT_ID, name: 'Rail 390 Test Event' }]),
  };
}

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  resetEventsCacheForTests();
});

describe('src/decisions-data/DEC-919.md: DirectoryRail stands down at 390, its capabilities survive elsewhere', () => {
  it('the Segments · N and Duplicates · N tab chips are both present at 390 (the surviving paths for Saved segments and Possible duplicates)', async () => {
    stubPhoneMatchMedia();
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
    mockApi(baseRoutes());

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    // docs/design/Chautauqua Contacts.dc.html:203
    // `padding:15px 0; border-bottom:1px solid #E1DDCE; display:flex; align-items:center; gap:13px`
    // -- each row of the frame's phone body; the tab strip above it (not
    // the rail) still carries the Segments/Duplicates escape hatches.
    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace', { exact: false })).toBeInTheDocument();
    });

    const segmentsTab = screen.getByRole('tab', { name: /^Segments · \d+/ });
    expect(segmentsTab).toBeInTheDocument();

    const duplicatesTab = screen.getByRole('tab', { name: /^Duplicates · \d+/ });
    expect(duplicatesTab).toBeInTheDocument();
  });
});
