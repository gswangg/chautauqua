// DEC-154 layer-2 harness: renders the real App (its own BrowserRouter) at
// an unknown path and asserts the catch-all NotFound content shows up
// inside the app shell (Header still renders alongside it). Also covers
// the top-nav shell (DEC-369): wordmark, no count text in nav, no badges
// (wave 42 amendment), reviewer confinement to Review.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App, NAV_SECTIONS } from './App';
import { mockApi } from './test-utils/mockApi';
import { resetEventsCacheForTests } from './lib/useCurrentEvent';
import { matchesAdminRoute } from './lib/admin-routes';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_CSS = readFileSync(join(HERE, 'styles.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

beforeEach(() => {
  window.history.pushState({}, '', '/admin/this-page-does-not-exist');
});

afterEach(() => {
  // vitest.config.ts doesn't set test.globals, so RTL's afterEach-based
  // auto-cleanup never registers (it only fires when `afterEach` is a
  // real global). This file renders more than once per run, so clean up
  // explicitly or later tests see earlier tests' DOM.
  cleanup();
  window.history.pushState({}, '', '/admin');
  window.localStorage.clear();
  // DEC-024 amendment (wave 51): loadEventsOnce()'s cache is scoped to one
  // real page load (a full navigation) -- this file renders more than once
  // per run, so a stale cached /events response would otherwise leak.
  resetEventsCacheForTests();
});

describe('App catch-all route', () => {
  it('renders NotFound content for an unmatched path, inside the app shell', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "That page isn't here" })).toBeInTheDocument();
    });

    // DEC-945: the attempted path is no longer shown in the card body.
    // DEC-369 amendment (wave 72): there is no shell footer -- Sign out
    // lives in the header identity block, still one click from any page,
    // 404 included.
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview ›' })).toHaveAttribute('href', '/admin/overview');
  });

  // DEC-154 (amendment, wave 53): the pushState path above
  // ('/admin/this-page-does-not-exist') is itself proof the router's own
  // catch-all still fires for a path ADMIN_ROUTE_PATTERNS does not
  // declare, and this asserts the manifest agrees before the router is
  // ever asked (Worker-side, this same predicate is what gates the 404 in
  // src/routes/root.tsx).
  it('the router-driving admin route manifest agrees the unmatched pushState path is not a declared route', () => {
    expect(matchesAdminRoute('/this-page-does-not-exist')).toBe(false);
  });

  it('the manifest resolves a known path (proving RoutedContent, which renders FROM this same tuple, still resolves it)', () => {
    expect(matchesAdminRoute('/overview')).toBe(true);
    expect(matchesAdminRoute('/review/plans/xyz')).toBe(true);
    expect(matchesAdminRoute('/submissions/abc123')).toBe(true);
  });
});

describe('Root redirect (DEC-806)', () => {
  it('lands an organizer on / at /overview, with Overview marked current', async () => {
    window.history.pushState({}, '', '/admin');
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [{ id: 'ev-1', name: 'DevFlow Conf' }], total: 1, page: 1, perPage: 50 },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { contactsOwing: 0, overdueAssignments: 0 },
        agenda: { unplaced: 0, conflicts: 0 },
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin/overview');
    });
    const primaryNav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(primaryNav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });

  it('still bounces a reviewer landing on / to /review, not /overview', async () => {
    window.history.pushState({}, '', '/admin');
    mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin/review');
    });
    const primaryNav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(primaryNav).getByRole('link', { name: 'Review' })).toBeInTheDocument();
    expect(within(primaryNav).queryByRole('link', { name: 'Overview' })).not.toBeInTheDocument();
  });
});

describe('App shell (DEC-369)', () => {
  it('renders the lowercase wordmark', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('chautauqua')).toBeInTheDocument();
    });
  });

  it('nav links carry no count text, only the section label', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [{ id: 'ev-1', name: 'DevFlow Conf' }], total: 1, page: 1, perPage: 50 },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { contactsOwing: 0, overdueAssignments: 0 },
        agenda: { unplaced: 0, conflicts: 0 },
      },
    });

    render(<App />);

    const primaryNav = await screen.findByRole('navigation', { name: 'Primary' });
    const submissionsLink = within(primaryNav).getByRole('link', { name: 'Submissions' });
    expect(submissionsLink).toHaveTextContent(/^Submissions$/);
  });

  it('carries no nav count badge when overdue/conflict counts are zero', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [{ id: 'ev-1', name: 'DevFlow Conf' }], total: 1, page: 1, perPage: 50 },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { contactsOwing: 0, overdueAssignments: 0 },
        agenda: { unplaced: 0, conflicts: 0 },
      },
    });

    render(<App />);

    const primaryNav = await screen.findByRole('navigation', { name: 'Primary' });
    within(primaryNav).getByRole('link', { name: 'Speakers' });
    expect(screen.queryByText(/LATE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CLASH/)).not.toBeInTheDocument();
  });

  // DEC-369 amendment (wave 42): no v6 frame carries the nav count badges --
  // even a non-zero overdue/conflict count renders no badge text. The
  // exception counts keep their real homes (Overview worklists, Agenda's
  // own counter), never the nav.
  it('carries no nav count badge even when overdue/conflict counts are non-zero', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [{ id: 'ev-1', name: 'DevFlow Conf' }], total: 1, page: 1, perPage: 50 },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { contactsOwing: 2, overdueAssignments: 3 },
        agenda: { unplaced: 1, conflicts: 2 },
      },
    });

    render(<App />);

    const primaryNav = await screen.findByRole('navigation', { name: 'Primary' });
    await within(primaryNav).findByRole('link', { name: 'Speakers' });
    expect(screen.queryByText(/3 LATE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2 CLASH/)).not.toBeInTheDocument();
    expect(screen.queryByText(/LATE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CLASH/)).not.toBeInTheDocument();
  });

  it('confines reviewers to the Review section only', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    await screen.findByRole('link', { name: 'Review' });
    expect(screen.queryByRole('link', { name: 'Submissions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Speakers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });
});

describe('Desktop header single row + identity (DEC-576/369)', () => {
  it('renders wordmark, nav, event name as text, and the identity grammar in one row, with Sign out IN the header', async () => {
    mockApi({
      'GET /api/v1/me': {
        userId: 'u-1',
        email: 'organizer@example.com',
        name: 'Jordan Alvarez',
        role: 'organizer',
        orgId: 'org-1',
      },
      'GET /api/v1/events': { items: [{ id: 'ev-1', name: 'DevFlow Conf' }], total: 1, page: 1, perPage: 50 },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { contactsOwing: 0, overdueAssignments: 0 },
        agenda: { unplaced: 0, conflicts: 0 },
      },
    });

    render(<App />);

    const header = await screen.findByRole('banner');
    // Single row: header is a flex container with no wrap (styled via
    // .chq-header's flex-wrap: nowrap), and wordmark/nav/identity all live
    // directly inside it.
    expect(within(header).getByText('chautauqua')).toBeInTheDocument();
    expect(within(header).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    // The event renders as plain text, not a <select>, in its own case
    // (wave 42: no uppercase transform). DEC-978: the switcher's fetch
    // waits for `me` to resolve before firing, so this needs a waitFor
    // rather than a synchronous assertion.
    await waitFor(() => {
      expect(within(header).getByText('DevFlow Conf')).toBeInTheDocument();
    });
    expect(within(header).queryByRole('combobox')).not.toBeInTheDocument();
    // DEC-369 amendment (wave 42): the frames' grammar is "JORDAN A."
    // (given name in caps + surname initial + period), not "J. ALVAREZ" —
    // never a bare email, never the literal 'undefined'.
    expect(within(header).getByText('JORDAN A.', { exact: false })).toBeInTheDocument();
    expect(within(header).queryByText('organizer@example.com')).not.toBeInTheDocument();
    expect(within(header).queryByText(/undefined/i)).not.toBeInTheDocument();
    // DEC-369 amendment (wave 72): no shell footer -- Sign out rejoins the
    // header identity beside the identity label ("JORDAN A. · SIGN OUT"),
    // a real button, never a menu.
    expect(within(header).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('falls back to the email local-part, uppercased, when name is null', async () => {
    mockApi({
      'GET /api/v1/me': {
        userId: 'u-1',
        email: 'organizer@example.com',
        name: null,
        role: 'organizer',
        orgId: 'org-1',
      },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ORGANIZER', { exact: false })).toBeInTheDocument();
    });
    expect(screen.queryByText('organizer@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  // DEC-369: the two design sources differ deliberately -- organizer chrome
  // reads "JORDAN A." (initials form), reviewer chrome reads the full
  // surname, "SAM WHITFIELD" (docs/design/Chautauqua Review.dc.html:152,313
  // `</div>`).
  it('renders the reviewer full name, not the organizer initials form', async () => {
    mockApi({
      'GET /api/v1/me': {
        userId: 'u-2',
        email: 'sam@example.com',
        name: 'Sam Whitfield',
        role: 'reviewer',
        orgId: 'org-1',
      },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    const header = await screen.findByRole('banner');
    await waitFor(() => {
      expect(within(header).getByText('SAM WHITFIELD', { exact: false })).toBeInTheDocument();
    });
    expect(within(header).queryByText('SAM W.', { exact: false })).not.toBeInTheDocument();
  });
});

// DEC-369 amendment (wave 72): no bottom chrome bar -- the shell footer is
// deleted, and Sign out rejoins .chq-header-identity beside the identity
// label (still never a menu, still one click from any page). The reviewer
// reassurance ("Scores stay hidden from other reviewers") is NOT re-homed
// in chrome: it belongs to the review queue's own footer row (DEC-874,
// implemented by the queue), so chrome must stop carrying it entirely.
describe('No shell footer; Sign out lives in the header (DEC-369 amendment, wave 72)', () => {
  it('renders no .chq-footer / contentinfo landmark at all', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    await screen.findByRole('banner');
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('carries Sign out in the header for an organizer, with no "scores stay hidden" note anywhere in chrome', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    const header = await screen.findByRole('banner');
    expect(within(header).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('Scores stay hidden from other reviewers')).not.toBeInTheDocument();
  });

  it('carries Sign out in the header for a reviewer, with no "scores stay hidden" note in chrome', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    const header = await screen.findByRole('banner');
    expect(within(header).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('Scores stay hidden from other reviewers')).not.toBeInTheDocument();
  });
});

// DEC-831: a hand-listed section/path pair desyncs the moment NAV_SECTIONS
// changes -- enumerate the real array instead. Regression coverage for the
// '/review/*'.replace(/\*$/, '') bug (yields '/review/', a trailing slash
// NavLink's isActive/aria-current match never resolves against the
// router's actual '/review' pathname), generalized to every section so a
// future section with the same '/foo/*' shape is covered automatically.
describe('Nav link active-state coverage (DEC-831)', () => {
  it.each(NAV_SECTIONS.map((section) => [section.label, section.path] as const))(
    'marks %s as active with aria-current="page" when the router is at its own path',
    async (label, path) => {
      const target = path.replace(/\/\*$/, '');
      window.history.pushState({}, '', `/admin${target}`);
      mockApi({
        'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
        'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
      });

      render(<App />);

      const primaryNav = await screen.findByRole('navigation', { name: 'Primary' });
      const link = await within(primaryNav).findByRole('link', { name: label });
      await waitFor(() => {
        expect(link).toHaveClass('is-active');
        expect(link).toHaveAttribute('aria-current', 'page');
      });
    },
  );
});

describe('Phone tab bar (DEC-381)', () => {
  it('shows Overview, Submissions, Speakers and Content for an organizer, not Review', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    const tabbar = await screen.findByRole('navigation', { name: 'Primary, phone' });
    expect(within(tabbar).getByRole('link', { name: /^Overview/ })).toBeInTheDocument();
    expect(within(tabbar).getByRole('link', { name: /^Submissions/ })).toBeInTheDocument();
    expect(within(tabbar).getByRole('link', { name: /^Speakers/ })).toBeInTheDocument();
    expect(within(tabbar).getByRole('link', { name: /^Content/ })).toBeInTheDocument();
    expect(within(tabbar).queryByRole('link', { name: /^Review/ })).not.toBeInTheDocument();
    expect(within(tabbar).getByRole('button', { name: /^More/ })).toBeInTheDocument();
  });

  it('renders no tab bar at all for a reviewer -- one section is not a navigation choice, and the identity block carries Sign out instead', async () => {
    // DEC-576 (wave-86 amendment): a bottom tab bar with a single item
    // draws no band in either phone frame (Chautauqua Content.dc.html:229
    // draws the five-tab band only on the multi-section landing; :278's
    // docked drill on the SAME page has no band at all). A reviewer has
    // exactly one section (Review), so PhoneTabBar returns null below 2
    // primary tabs and there is no More sheet -- styles.css un-hides
    // `.chq-user-identity` at <=700px whenever `.chq-shell` has no
    // `.chq-tabbar`, so Sign out stays reachable via the header identity
    // block this test already finds unconditionally (CSS media queries do
    // not apply in jsdom).
    mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    const header = await screen.findByRole('banner');
    expect(within(header).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    // docs/design/Chautauqua Content.dc.html:229 `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:10px 8px 14px; display:flex; gap:2px` -- the five-tab band this line draws is absent for a reviewer's single-section nav.
    expect(screen.queryByRole('navigation', { name: 'Primary, phone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^More/ })).not.toBeInTheDocument();
  });

  it('reveals a Sign out control in the More sheet, which stays closed by default', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    const tabbar = await screen.findByRole('navigation', { name: 'Primary, phone' });
    expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument();

    const moreButton = within(tabbar).getByRole('button', { name: /^More/ });
    moreButton.click();

    const dialog = await screen.findByRole('dialog', { name: 'More' });
    expect(within(dialog).getByRole('link', { name: 'Review' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Agenda' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Comms' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Contacts' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});

// DEC-576 amendment (wave 13): the phone tab bar is the shell's BOTTOM
// region -- it must be the last child of .chq-shell, after <main>, so its
// existing `border-top`/`display:flex` CSS reads as a bottom bar without any
// `order:` declaration.
describe('Phone tab bar is the shell bottom region (DEC-576 amendment, wave 13)', () => {
  it('places nav.chq-tabbar after main.chq-main in DOM order', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    const { container } = render(<App />);

    await screen.findByRole('navigation', { name: 'Primary, phone' });
    const main = container.querySelector('main.chq-main');
    const bar = container.querySelector('nav.chq-tabbar');
    expect(main).not.toBeNull();
    expect(bar).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(main!.compareDocumentPosition(bar!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders both main.chq-main and nav.chq-tabbar as direct children of .chq-shell', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    const { container } = render(<App />);

    await screen.findByRole('navigation', { name: 'Primary, phone' });
    const shell = container.querySelector('.chq-shell');
    expect(shell).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const children = Array.from(shell!.children).map((el) => el.tagName.toLowerCase());
    expect(children).toContain('main');
    expect(children).toContain('nav');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(shell!.querySelector(':scope > main.chq-main')).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(shell!.querySelector(':scope > nav.chq-tabbar')).not.toBeNull();
  });

  it('still opens the More sheet, lists non-primary sections, and offers Sign out', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    const tabbar = await screen.findByRole('navigation', { name: 'Primary, phone' });
    const moreButton = within(tabbar).getByRole('button', { name: /^More/ });
    moreButton.click();

    const dialog = await screen.findByRole('dialog', { name: 'More' });
    expect(within(dialog).getByRole('link', { name: 'Review' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Agenda' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Comms' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Contacts' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});

// DEC-857: RoleGate must not mount any routed page while identity is still
// resolving -- an organizer-scoped page firing organizer-only fetches during
// a reviewer's login redirect is the same defect as a gate that renders its
// children before it knows who is signed in.
describe('RoleGate blocks routed content while /me is unresolved (DEC-857)', () => {
  it('never issues the overview fetch while GET /api/v1/me is still pending', async () => {
    window.history.pushState({}, '', '/admin');
    let resolveMe: (value: unknown) => void = () => {};
    const meBodyPromise = new Promise<unknown>((resolve) => {
      resolveMe = resolve;
    });
    const jsonResponse = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path: string = (rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0]) ?? '';
      // Each call awaits the SAME resolution signal but builds its OWN fresh
      // Response -- a Response body can only be read once, and both useMe
      // (App) and the header's own /me read independently.
      if (path.endsWith('/api/v1/me')) return jsonResponse(await meBodyPromise);
      if (path.endsWith('/api/v1/events')) {
        return jsonResponse({ items: [{ id: 'ev-1', name: 'DevFlow Conf' }], total: 1, page: 1, perPage: 50 });
      }
      if (path.endsWith('/api/v1/events/ev-1/overview')) {
        return jsonResponse({
          speakers: { contactsOwing: 0, overdueAssignments: 0 },
          agenda: { unplaced: 0, conflicts: 0 },
        });
      }
      throw new Error(`unexpected fetch to "${path}" during RoleGate loading test`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    // Give any pending microtasks/effects a chance to fire while /me is
    // still unresolved.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const calledPaths: string[] = fetchMock.mock.calls.map((call: [RequestInfo | URL]) => {
      const input = call[0];
      const rawUrl = typeof input === 'string' ? input : input.toString();
      return rawUrl.split('?')[0] ?? '';
    });
    expect(calledPaths.some((p: string) => p.includes('/overview'))).toBe(false);

    resolveMe({ userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' });

    const primaryNav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(primaryNav).getByRole('link', { name: 'Overview' })).toBeInTheDocument();
  });
});

// DEC-369 amendment (wave 22): the fitted sub-pixel geometry chased gate-4/
// gate-5 render measurements that are now superseded; the vendored frame
// outranks a render measurement. jsdom doesn't run real layout, so this
// pins the CSS declarations directly against the stylesheet — a regression
// guard against the fitted geometry drifting back, not a live pixel
// measurement.
describe('Header/nav geometry pinned to the frame (DEC-369 amendment)', () => {
  it('.chq-header: padding 15px 34px, gap 22px (docs/design/Chautauqua Overview.dc.html:33)', () => {
    // docs/design/Chautauqua Overview.dc.html:33 `border-bottom:1px solid #1B1D17;
    // padding:15px 34px; display:flex; align-items:center; gap:22px`
    const body = topLevelRuleBody(STYLES_CSS, '.chq-header');
    expect(body).toMatch(/padding:\s*15px 34px/);
    expect(body).toMatch(/gap:\s*22px/);
  });

  it('.chq-nav: item gap 15px, no margin-left (docs/design/Chautauqua Overview.dc.html:35)', () => {
    // docs/design/Chautauqua Overview.dc.html:35 `display:flex; align-items:center;
    // gap:15px; font-size:13px; font-weight:600; line-height:1`
    const body = topLevelRuleBody(STYLES_CSS, '.chq-nav');
    expect(body).toMatch(/gap:\s*15px/);
    expect(body).not.toMatch(/margin-left/);
  });
});

// DEC-989 (wave 85 amendment): a page mounts its own docked band (e.g.
// Content's phone Select mode -- Chautauqua Content.dc.html:247-287 draws
// ONE footer region, not the dock stacked over the tab bar; cited with its
// strict form, and receipted, at the first it() below) by setting
// `data-chq-phone-dock` on its page root, and styles.css's
// `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar { display: none }`
// rule is the shell's only consumer of that signal. jsdom applies no
// stylesheet (this file's own topLevelRuleBody helper above exists
// because of that), but jsdom's querySelector DOES evaluate real CSS
// selector logic including :has() -- so rendering the real shell and
// toggling the attribute on a genuine descendant of .chq-main proves the
// selector reaches into the routed subtree and back out to its sibling,
// in both directions, without needing to boot a specific page's own data
// fetching.
describe('.chq-tabbar suppression via data-chq-phone-dock (DEC-989 amendment, wave 85)', () => {
  it('the shell-suppression selector matches nothing when no page root declares the attribute', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    await screen.findByRole('navigation', { name: 'Primary, phone' });
    // docs/design/Chautauqua Content.dc.html:247-287 `width:390px; height:844px` -- the shell's suppression selector, standing in for the page-mounted docked band this frame draws in place of the tab bar.
    expect(document.querySelector('.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar')).toBeNull();
  });

  it('the shell-suppression selector matches the tab bar once a descendant of .chq-main declares the attribute', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    const { container } = render(<App />);

    await screen.findByRole('navigation', { name: 'Primary, phone' });
    const main = container.querySelector('main.chq-main');
    expect(main).not.toBeNull();
    // A page root is some descendant of .chq-main (RoleGate -> RoutedContent
    // -> the page's own outer div) -- exercising the attribute a level
    // below .chq-main itself proves :has() searches the whole subtree, not
    // just direct children.
    const pageRootStandIn = document.createElement('div');
    pageRootStandIn.setAttribute('data-chq-phone-dock', 'true');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    main!.appendChild(pageRootStandIn);

    const suppressed = document.querySelector('.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar');
    expect(suppressed).not.toBeNull();
    expect(suppressed).toBe(document.querySelector('nav.chq-tabbar'));
  });
});
