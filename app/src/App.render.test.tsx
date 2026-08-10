// DEC-154 layer-2 harness: renders the real App (its own BrowserRouter) at
// an unknown path and asserts the catch-all NotFound content shows up
// inside the app shell (Nav still renders alongside it).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
import { mockApi } from './test-utils/mockApi';

beforeEach(() => {
  window.history.pushState({}, '', '/admin/this-page-does-not-exist');
});

afterEach(() => {
  window.history.pushState({}, '', '/admin');
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
    // Nav (with the sign-out control) still renders around the 404 body.
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Overview' })).toHaveAttribute('href', '/admin/overview');
  });
});
