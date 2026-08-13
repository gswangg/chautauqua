// DEC-608/w4-g: dedicated render coverage for NotFoundPage itself (the
// catch-all reached via App.tsx's wildcard Route, covered end-to-end in
// App.render.test.tsx). Asserts the design-doc-matched body copy and that
// the attempted path is named, with a way back to Overview -- never a
// silent bounce/redirect. w15-g: also covers the event-name eyebrow
// (useCurrentEvent.ts's resolution) and its "Not found" fallback when no
// event resolves.
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
  it('names the path it could not find and links back to Overview', async () => {
    mockApi({ 'GET /api/v1/events': { items: [], total: 0, page: 1, perPage: 50 } });

    render(
      <MemoryRouter initialEntries={['/admin/some-missing-section']}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: "That page isn't here" })).toBeInTheDocument();
    expect(screen.getByText('/admin/some-missing-section', { exact: false })).toBeInTheDocument();

    const overviewLink = screen.getByRole('link', { name: 'Go to Overview' });
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
