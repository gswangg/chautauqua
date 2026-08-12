// DEC-608/w4-g: dedicated render coverage for NotFoundPage itself (the
// catch-all reached via App.tsx's wildcard Route, covered end-to-end in
// App.render.test.tsx). Asserts the design-doc-matched body copy and that
// the attempted path is named, with a way back to Overview -- never a
// silent bounce/redirect.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFound';

afterEach(() => {
  cleanup();
});

describe('NotFoundPage', () => {
  it('names the path it could not find and links back to Overview', () => {
    render(
      <MemoryRouter initialEntries={['/admin/some-missing-section']}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText('/admin/some-missing-section', { exact: false })).toBeInTheDocument();

    const overviewLink = screen.getByRole('link', { name: 'Go to Overview' });
    expect(overviewLink).toHaveAttribute('href', '/overview');
  });
});
