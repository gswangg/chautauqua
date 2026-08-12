// DEC-154 layer-2 harness: renders the real App (its own BrowserRouter) at
// an unknown path and asserts the catch-all NotFound content shows up
// inside the app shell (Header still renders alongside it). Also covers
// the w1-a top-nav shell (DEC-369): wordmark, no count text in nav, badge
// only for exceptions, reviewer confinement to Review.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
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
      expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    });

    expect(screen.getByText('/this-page-does-not-exist', { exact: false })).toBeInTheDocument();
    // Header (with the sign-out control) still renders around the 404 body.
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Overview' })).toHaveAttribute('href', '/admin/overview');
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
