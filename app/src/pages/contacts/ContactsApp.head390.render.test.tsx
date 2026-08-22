// task v12m-w16-ui-r3-e (src/decisions-data/DEC-976.md amendment, src/decisions-data/DEC-180.md
// amendment): five wave-16 lanes each pinned their OWN piece of the
// Contacts 390 head (FilterRulesPanel.ruleChips, FilterRulesPanel.builderDisclosure,
// SegmentPillStrip, DirectoryRail.phone390, ContactsApp.headCounter) but
// nothing asserted how those pieces sit TOGETHER. The frame draws one
// uninterrupted band -- counter -> H1 -> search -> rule strip -> pill
// strip -> card list -- so this file is the ONE composition receipt: DOM
// order end to end, asserted with compareDocumentPosition so order (not
// mere presence) is the subject. It also pins the app's two head
// intrusions (title-actions, panel tablist) BY NAME. Finding 6 of
// docs/design/audit/contacts-v12.md, which originally recorded these as an
// open residual, is CLOSED per src/decisions-data/DEC-976.md's
// `## Amendment (wave 27, REVERSES the wave-16 r5 amendment)` -- both
// intrusions are RULED BLESSED frame-silent additions, not a residual
// owed to any owning sheet -- so this file is that ruling's receipt.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsApp } from './ContactsApp';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';
import type { ContactListItem, Segment } from './types';

const EVENT_ID = 'evt-contacts-head-390';

const CONTACTS: ContactListItem[] = [
  { id: 'ct1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Acme', labels: [] },
  { id: 'ct2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', company: 'Navy', labels: [] },
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

/** DOM-order helper: true iff `a` precedes `b` (a is earlier in document
 * order, not a descendant relation) via Node.compareDocumentPosition,
 * so ORDER is the thing under test, not mere co-presence. */
function precedes(a: Element, b: Element): boolean {
  // eslint-disable-next-line no-bitwise
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe('ContactsApp 390 head composition receipt (src/decisions-data/DEC-976.md amendment, src/decisions-data/DEC-180.md amendment)', () => {
  it('draws counter -> H1 -> search -> rule strip -> pill strip -> card list, in that DOM order, at phone width', async () => {
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
      'GET /api/v1/contacts': listEnvelope(CONTACTS, { total: 2 }),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/contacts']}>
        <ContactsApp />
      </MemoryRouter>,
    );

    // Wait for stats to settle (mounts the head counter) and the segment
    // pill (mounts once GET /segments resolves) so every node in the chain
    // below actually exists before we read document order.
    await screen.findByText('2 of 318');
    await waitFor(() => {
      expect(screen.getByText('Speakers · 41')).toBeInTheDocument();
    });
    await screen.findByText('Ada Lovelace', { exact: false });

    const headCount = container.querySelector('.chq-contacts-head-count');
    const title = container.querySelector('.chq-page-title');
    const search = container.querySelector('.chq-contacts-search');
    const chipstrip = container.querySelector('.chq-contacts-filter-chipstrip');
    const pills = container.querySelector('.chq-contacts-segment-pills');
    const tableWrap = container.querySelector('.chq-contacts-table-wrap');
    const titleActions = container.querySelector('.chq-contacts-title-actions');
    const tablist = container.querySelector('[role="tablist"]');
    const rail = container.querySelector('.chq-contacts-rail');

    expect(headCount).toBeInTheDocument();
    expect(title).toBeInTheDocument();
    expect(search).toBeInTheDocument();
    expect(chipstrip).toBeInTheDocument();
    expect(pills).toBeInTheDocument();
    expect(tableWrap).toBeInTheDocument();
    expect(titleActions).toBeInTheDocument();
    expect(tablist).toBeInTheDocument();

    // The frame's phone head band (:180-198) draws the counter, H1, search
    // and both strips as ONE uninterrupted column, ending in the scrolling
    // card list (:201). The app's MEASURED order puts the H1 BEFORE the
    // counter (the counter is appended as the H1 line's own sibling, per
    // src/decisions-data/DEC-919.md -- the frame's wordmark-row counter has
    // no shell home on this page) -- the opposite of the frame's own
    // counter-above-H1 wordmark-row layout. Pinned as MEASURED below, never
    // adjusted to match the frame's order (this task pins what IS true).

    // docs/design/Chautauqua Contacts.dc.html:185
    // `font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1`
    expect(precedes(title!, headCount!)).toBe(true);
    // docs/design/Chautauqua Contacts.dc.html:186
    // `border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:14px; color:#565A4B; background:#FAF8F2`
    expect(precedes(headCount!, search!)).toBe(true);
    // docs/design/Chautauqua Contacts.dc.html:187
    // `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch`
    expect(precedes(search!, chipstrip!)).toBe(true);
    // docs/design/Chautauqua Contacts.dc.html:194
    // `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch`
    expect(precedes(chipstrip!, pills!)).toBe(true);
    // docs/design/Chautauqua Contacts.dc.html:201
    // `flex:1; min-height:0; overflow-y:auto; padding:4px 16px 16px`
    expect(precedes(pills!, tableWrap!)).toBe(true);

    // --- Blessed frame-silent additions (this is the ruling's receipt) --
    // The frame draws no control cluster between the counter/H1 line and
    // the search box, and no panel switcher anywhere on this band, but per
    // src/decisions-data/DEC-976.md's `## Amendment (wave 27, REVERSES the
    // wave-16 r5 amendment)` both intrusions are RULED BLESSED: a
    // page-level create/import cluster and a page-specific four-panel
    // switcher cannot land in a single owning sheet (app/src/styles.css is
    // shell chrome shared by every admin page) without either appearing
    // everywhere or becoming page-conditioned shell, and neither may be
    // hidden -- src/decisions-data/DEC-919.md's carve-out needs a surviving full-screen path this
    // landing does not have. A static frame draws ONE panel of this
    // four-panel surface in its default state and cannot depict a switcher
    // or a create path, the same disposition already given to MergePage's
    // `.chq-contacts-merge-picks` (DEC-663 wave-17), the Change-password
    // dock hint (docs/design/audit/account-docs-v12.md), the portal's
    // "Your submissions" section (DEC-729), and Speakers' "Roster >"
    // trigger. Finding 6 is CLOSED, not reassigned. Pinned BY NAME so a
    // reshuffle in either direction still fails this test loudly.
    //
    // docs/design/Chautauqua Contacts.dc.html:183
    // `margin-left:auto; font-size:12px; font-weight:600; color:#565A4B`
    // -- the frame draws nothing between the counter and the search box;
    // the app inserts `.chq-contacts-title-actions` (Import CSV / Export
    // CSV / New contact, DEC-711 amendment wave 4) between them -- BLESSED.
    expect(precedes(headCount!, titleActions!)).toBe(true);
    expect(precedes(titleActions!, search!)).toBe(true);
    // docs/design/Chautauqua Contacts.dc.html:186
    // `border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:14px; color:#565A4B; background:#FAF8F2`
    // -- MEASURED: the `role="tablist"` (DEC-710) lands BEFORE the search
    // box -- BLESSED.
    expect(precedes(tablist!, search!)).toBe(true);
    // (Directory/Duplicates/Segments/Pipeline tablist and search share one
    // row -- tab strip first, search second -- so the tablist lands
    // upstream of search, not "between search and the rule strip" as a
    // first read of the frame might suggest.)
    expect(precedes(titleActions!, tablist!)).toBe(true);

    // The rail stands down at 390 (src/decisions-data/DEC-919.md, receipted by
    // DirectoryRail.phone390.render.test.tsx and contacts-rail-390.test.ts) --
    // it renders unconditionally into the tree and contacts.css's terminal
    // max-width:700px block is what hides it; jsdom applies no stylesheet,
    // so this file records presence-in-tree only, never re-asserting the
    // CSS rule those two files already own.
    expect(rail).toBeInTheDocument();

    // The builder is collapsed by default: the 390 rule strip's OWN row
    // never carries `is-builder-open` on first paint.
    const filterRulesRow = container.querySelector('.chq-contacts-filter-rules-row');
    expect(filterRulesRow).toBeInTheDocument();
    expect(filterRulesRow).not.toHaveClass('is-builder-open');
  });
});
