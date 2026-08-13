// DEC-608/w4-g: dedicated render coverage for NotFoundPage itself (the
// catch-all reached via App.tsx's wildcard Route, covered end-to-end in
// App.render.test.tsx). w15-g: also covers the event-name eyebrow
// (useCurrentEvent.ts's resolution) and its "Not found" fallback when no
// event resolves. DEC-945: the card no longer names the attempted path
// (the frame's body copy names possible causes instead) -- asserts the
// shared card class, one heading, and the two link labels instead.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFound';
import { mockApi } from '../test-utils/mockApi';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('NotFoundPage', () => {
  it('renders the shared card without the attempted path, linking back to Overview', async () => {
    mockApi({ 'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 } });

    render(
      <MemoryRouter initialEntries={['/admin/some-missing-section']}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    const heading = screen.getByRole('heading', { name: "That page isn't here" });
    expect(heading).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(document.querySelector('.chq-notfound-card')).toBeInTheDocument();
    expect(screen.queryByText('/admin/some-missing-section', { exact: false })).not.toBeInTheDocument();

    const overviewLink = screen.getByRole('link', { name: 'Overview ›' });
    expect(overviewLink).toHaveAttribute('href', '/overview');

    const submissionsLink = screen.getByRole('link', { name: 'Submissions ›' });
    expect(submissionsLink).toHaveAttribute('href', '/submissions');

    await waitFor(() => {
      expect(screen.getByText('Not found')).toBeInTheDocument();
    });
  });

  it('shows the current event name as the eyebrow when one resolves', async () => {
    window.localStorage.setItem('chq.currentEventId', 'ev-1');
    mockApi({
      'GET /api/v1/events': {
        items: [{ id: 'ev-1', name: 'DevFlow Conf' }],
        total: 1,
        page: 1,
        perPage: 50,
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin/some-missing-section']}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('DevFlow Conf')).toBeInTheDocument();
    });
  });
});
