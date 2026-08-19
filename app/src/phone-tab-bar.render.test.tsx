// DEC-381 (wave-109 amendment, task v12m-w5-l): the phone tab bar's five
// items match what the frames actually draw -- slots 1-3 fixed
// (Overview/Submissions/Speakers), slot 4 contextual (Contacts on the
// Contacts section, Comms on the Comms section, Content everywhere else),
// slot 5 More; every item (not just the active one) carries a dot BEFORE
// its label, and More carries the DOT_ON state whenever the current
// section is none of the four rendered tabs. Every frame's own `tabs:
// [...]` data array agrees on the ordering and the dot-then-label row
// shape -- individual citations, each beside the expect( it backs, sit
// with the test that exercises that frame's claim.
//
// Routes below navigate to a NONEXISTENT sub-path under each section
// (e.g. "/admin/contacts/x") so the router falls through to NotFoundPage
// rather than mounting the real section page -- the tab bar renders
// identically either way (it reads only the location, not the routed
// page), and this avoids having to mock every section page's own API
// calls just to read the shell chrome around it.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
import { mockApi } from './test-utils/mockApi';
import { resetEventsCacheForTests } from './lib/useCurrentEvent';

afterEach(() => {
  // vitest.config.ts doesn't set test.globals, so RTL's afterEach-based
  // auto-cleanup never registers (mirrors App.render.test.tsx's own
  // afterEach) -- this file renders more than once per run.
  cleanup();
  window.history.pushState({}, '', '/admin');
  window.localStorage.clear();
  resetEventsCacheForTests();
});

beforeEach(() => {
  mockApi({
    'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
    'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
  });
});

/** Renders the shell at the given admin-relative path (a NONEXISTENT
 * sub-path, so no section page mounts) and returns its phone tab bar. */
async function renderTabBar(path: string) {
  window.history.pushState({}, '', path);
  render(<App />);
  return screen.findByRole('navigation', { name: 'Primary, phone' });
}

/** The dot span leading an item's content, asserted to be the item's
 * FIRST child node -- the frame's row draws the dot before the label. */
function leadingDot(item: HTMLElement): HTMLElement {
  const first = item.firstChild;
  expect(first).not.toBeNull();
  expect((first as HTMLElement).nodeType).toBe(Node.ELEMENT_NODE);
  const el = first as HTMLElement;
  expect(el.classList.contains('chq-dot')).toBe(true);
  return el;
}

describe('phone tab bar slot 4 is contextual (DEC-381 wave-109 amendment)', () => {
  it('shows Content in slot 4 at /overview (a non-Contacts, non-Comms section)', async () => {
    // docs/design/Chautauqua Overview.dc.html:835 `tabs: [`
    const bar = await renderTabBar('/admin/overview/x');
    const links = within(bar).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Overview', 'Submissions', 'Speakers', 'Content']);
  });

  it('shows Contacts in slot 4 while on the Contacts section', async () => {
    // docs/design/Chautauqua Contacts.dc.html:1015 `tabs: [`
    const bar = await renderTabBar('/admin/contacts/x');
    const links = within(bar).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Overview', 'Submissions', 'Speakers', 'Contacts']);
  });

  it('shows Comms in slot 4 while on the Comms section', async () => {
    // docs/design/Chautauqua Comms.dc.html:970 `tabs: [`
    const bar = await renderTabBar('/admin/comms/x');
    const links = within(bar).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Overview', 'Submissions', 'Speakers', 'Comms']);
  });

  it('shows Content in slot 4 while on the Settings section (Settings is not slot 4)', async () => {
    // docs/design/Chautauqua Content.dc.html:501 `tabs: [`
    const bar = await renderTabBar('/admin/settings/x');
    const links = within(bar).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Overview', 'Submissions', 'Speakers', 'Content']);
  });
});

describe('More is DOT_ON exactly when the current section is off the rendered tabs (Settings frame)', () => {
  it('marks More active on /settings, where none of the four rendered tabs match', async () => {
    // docs/design/Chautauqua Settings.dc.html:1702 `tabs: [` -- the
    // Settings frame's own tabs array is the one with More at DOT_ON.
    const bar = await renderTabBar('/admin/settings/x');
    const more = within(bar).getByRole('button', { name: /^More/ });
    expect(more.classList.contains('is-active')).toBe(true);
    expect(leadingDot(more).classList.contains('is-on')).toBe(true);
  });

  it('leaves More inactive on /overview, where Overview is a rendered tab', async () => {
    const bar = await renderTabBar('/admin/overview/x');
    const more = within(bar).getByRole('button', { name: /^More/ });
    expect(more.classList.contains('is-active')).toBe(false);
    expect(leadingDot(more).classList.contains('is-on')).toBe(false);
  });
});

describe('every phone tab bar item draws a dot before its label (all five slots)', () => {
  it('renders a leading .chq-dot on every link and on More, in dot-then-label order', async () => {
    const bar = await renderTabBar('/admin/settings/x');
    const links = within(bar).getAllByRole('link');
    // docs/design/Chautauqua Submissions.dc.html:175 `flex:1;
    // min-height:44px; display:flex; flex-direction:column;
    // align-items:center; justify-content:center; gap:5px` -- the row
    // that draws each tab's dot span before its label span.
    expect(links).toHaveLength(4);
    for (const link of links) {
      leadingDot(link);
    }
    const more = within(bar).getByRole('button', { name: /^More/ });
    leadingDot(more);
  });
});
