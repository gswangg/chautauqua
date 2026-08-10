// DEC-144 layer-2 harness: component-render smoke test for the CRM-12
// dashboard drill-through. Guards the integration point between the
// top-companies widget (StatsStrip) and the DEC-149 rules filter used by the
// directory query: clicking a company must issue GET /contacts with a
// rules=[{field:'company',op:'eq',value}] query param, i.e. the drill-through
// rides the same rule mechanism as the filter builder rather than a parallel
// filter state.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-contacts-render';

function requestUrls(fetchMock: ReturnType<typeof mockApi>): string[] {
  return fetchMock.mock.calls.map(([input]) => (typeof input === 'string' ? input : input.toString()));
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

describe('ContactsApp render smoke (CRM-12 top-companies drill-through)', () => {
  it('turns a top-companies click into a DEC-149 company rule on the contacts query', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/stats': {
        total: 3,
        eventCount: 1,
        returningSpeakers: 1,
        topCompanies: [{ company: 'Acme', count: 2 }],
      },
      'GET /api/v1/segments': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope([
        { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme' },
      ]),
    });

    render(<ContactsApp />);

    const companyButton = await screen.findByRole('button', { name: 'Acme (2)' });

    const before = requestUrls(fetchMock).filter((u) => u.includes('/contacts?')).length;
    fireEvent.click(companyButton);

    await waitFor(() => {
      expect(requestUrls(fetchMock).filter((u) => u.includes('/contacts?')).length).toBeGreaterThan(before);
    });

    const lastContactsUrl = requestUrls(fetchMock)
      .filter((u) => u.includes('/contacts?'))
      .at(-1)!;
    const rulesParam = new URLSearchParams(lastContactsUrl.split('?')[1]).get('rules');
    expect(rulesParam).not.toBeNull();
    expect(JSON.parse(rulesParam!)).toEqual([{ field: 'company', op: 'eq', value: 'Acme' }]);
  });
});
