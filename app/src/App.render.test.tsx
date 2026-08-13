// DEC-154 layer-2 harness: renders the real App (its own BrowserRouter) at
// an unknown path and asserts the catch-all NotFound content shows up
// inside the app shell (Header still renders alongside it). Also covers
// the w1-a top-nav shell (DEC-369): wordmark, no count text in nav, badge
// only for exceptions, reviewer confinement to Review.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App, NAV_SECTIONS } from './App';
import { mockApi } from './test-utils/mockApi';

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
    // Header (with the sign-out control) still renders around the 404 body.
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview ›' })).toHaveAttribute('href', '/admin/overview');
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

  it('hides the exception badge when overdue/conflict counts are zero', async () => {
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

  it('shows an exception badge when overdue/conflict counts are non-zero', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [{ id: 'ev-1', name: 'DevFlow Conf' }], total: 1, page: 1, perPage: 50 },
      'GET /api/v1/events/ev-1/overview': {
        speakers: { contactsOwing: 2, overdueAssignments: 3 },
        agenda: { unplaced: 1, conflicts: 2 },
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('3 LATE')).toBeInTheDocument();
      expect(screen.getByText('2 CLASH')).toBeInTheDocument();
    });
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

describe('Desktop header single row + identity (DEC-576)', () => {
  it('renders wordmark, nav, event name as text, and initials · sign out in one row', async () => {
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
    // The event renders as plain text, not a <select>. DEC-978: the
    // switcher's fetch waits for `me` to resolve before firing, so this
    // needs a waitFor rather than a synchronous assertion.
    await waitFor(() => {
      expect(within(header).getByText('DevFlow Conf')).toBeInTheDocument();
    });
    expect(within(header).queryByRole('combobox')).not.toBeInTheDocument();
    // The user renders as initials-form "J. ALVAREZ" beside Sign out —
    // never a bare email, never the literal 'undefined'.
    expect(within(header).getByText('J. ALVAREZ', { exact: false })).toBeInTheDocument();
    expect(within(header).queryByText('organizer@example.com')).not.toBeInTheDocument();
    expect(within(header).queryByText(/undefined/i)).not.toBeInTheDocument();
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

  it('shows Review alone plus a More control for a reviewer, whose sheet carries Sign out', async () => {
    // DEC-392: reviewers have exactly one section (Review), so the More
    // sheet is their only route to Sign out once the phone header drops
    // the desktop identity block's Sign out button.
    mockApi({
      'GET /api/v1/me': { userId: 'u-2', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' },
      'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 },
    });

    render(<App />);

    const tabbar = await screen.findByRole('navigation', { name: 'Primary, phone' });
    expect(within(tabbar).getByRole('link', { name: /^Review/ })).toBeInTheDocument();
    const moreButton = within(tabbar).getByRole('button', { name: /^More/ });
    expect(moreButton).toBeInTheDocument();

    moreButton.click();

    const dialog = await screen.findByRole('dialog', { name: 'More' });
    expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
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
