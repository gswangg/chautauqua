// task v12m-w16-ui-r5-d (src/decisions-data/DEC-976.md wave-16-r5
// amendment): docs/design/audit/contacts-v12.md's Finding 6 named TWO
// candidate owners for the 390 head's two intrusions
// (.chq-contacts-title-actions, the panel-switcher tablist) -- a shell
// head band in app/src/styles.css, and a Contacts-landing phone dock built
// with the established .chq-phone-dock / data-chq-phone-dock mechanism.
// This is the receipt for FORECLOSING the dock candidate: app/src/styles.css
// suppresses the shell tab bar for any page that mounts a dock
// (`.chq-shell:has(.chq-phone-dock) .chq-tabbar` / `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar`),
// but the Contacts 390 landing frame draws that same tab bar as its own
// footer (see the citation immediately above the assertions in part (i)
// below, kept close to its expect( per app/src/frame-citation.scan.test.ts's
// receipt rule). So a dock on the landing would delete the footer the
// frame draws. Part
// (i) below asserts the rendered landing carries no dock at 390. Part (ii)
// is a source-level contrast: PipelineBoard.tsx legitimately mounts a dock
// (DEC-964, a one-screen drill with its own frame/band) -- reading that
// file (never rendering it here) proves the mechanism exists and is simply
// not used by the landing, so this test fails loudly the day someone gives
// the landing a dock instead of routing the residual to app/src/styles.css
// as docs/design/audit/contacts-v12.md's Finding 6 now names as sole owner.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import type { ContactListItem, Segment } from './types';

const EVENT_ID = 'evt-contacts-landing-footer-390';

const CONTACTS: ContactListItem[] = [
  { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', labels: [] },
];

const SEGMENTS: Segment[] = [
  { id: 'seg1', name: 'Speakers', rules: [{ field: 'company', op: 'eq', value: 'Acme' }], count: 41 },
];

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

describe('Contacts landing 390: no phone dock, so the shell tab-bar footer the frame draws survives (src/decisions-data/DEC-976.md wave-16-r5 amendment)', () => {
  it('renders no .chq-phone-dock and no [data-chq-phone-dock] element at 390 with the directory panel showing', async () => {
    mockApi({
      'GET /api/v1/contacts/stats': {
        total: 318,
        speakerCount: 40,
        returningSpeakers: 0,
        eventCount: 1,
        topCompanies: [],
      },
      'GET /api/v1/segments': listEnvelope(SEGMENTS),
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
      'GET /api/v1/contacts': listEnvelope(CONTACTS, { total: 1 }),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    await screen.findByText('1 of 318');
    await waitFor(() => {
      expect(screen.getByText('Speakers · 41')).toBeInTheDocument();
    });
    await screen.findByText('Ada Lovelace', { exact: false });

    // docs/design/Chautauqua Contacts.dc.html:214
    // `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:10px 8px 14px; display:flex; gap:2px`
    // docs/design/Chautauqua Contacts.dc.html:215
    // `<sc-for list="{{ tabs }}" as="t" hint-placeholder-count="5">`
    // -- frame draws the shell tab bar as this screen's own footer; no dock.
    expect(container.querySelector('.chq-phone-dock')).not.toBeInTheDocument();
    expect(container.querySelector('[data-chq-phone-dock]')).not.toBeInTheDocument();
  });

  it('source contrast: PipelineBoard.tsx DOES apply both chq-phone-dock and data-chq-phone-dock (DEC-964 drill dock, not the landing)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(here, 'PipelineBoard.tsx'), 'utf8');

    expect(source).toMatch(/className="chq-phone-dock"/);
    expect(source).toMatch(/data-chq-phone-dock/);
  });
});
