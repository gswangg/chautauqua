// DEC-678 (wave-3 amendment): PageSkeleton renders on the FIRST frame --
// no timer -- with role="status"/aria-busy and N placeholder rows shaped
// by variant, so a loading admin page's main region is never empty.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PageSkeleton } from './PageSkeleton';

afterEach(() => {
  cleanup();
});

describe('PageSkeleton', () => {
  it('renders with aria-busy on the first frame with no timers advanced', () => {
    vi.useFakeTimers();
    render(<PageSkeleton rows={4} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    vi.useRealTimers();
  });

  it('renders exactly `rows` placeholder rows for the table variant', () => {
    render(<PageSkeleton rows={5} variant="table" />);
    const status = screen.getByRole('status');
    expect(status.querySelectorAll('.chq-skeleton-row')).toHaveLength(5);
  });

  it('renders list-shaped rows for the list variant', () => {
    render(<PageSkeleton rows={3} variant="list" />);
    const status = screen.getByRole('status');
    const rows = status.querySelectorAll('.chq-skeleton-row-list');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelector('.chq-skeleton-bar-title')).toBeInTheDocument();
  });

  it('renders a title bar plus two columns for the detail variant', () => {
    render(<PageSkeleton rows={6} variant="detail" />);
    const status = screen.getByRole('status');
    expect(status.querySelector('.chq-skeleton-bar-title-lg')).toBeInTheDocument();
    expect(status.querySelectorAll('.chq-skeleton-detail-col')).toHaveLength(2);
  });

  it('carries a visually-hidden label defaulting to "Loading…"', () => {
    render(<PageSkeleton />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('accepts a custom label', () => {
    render(<PageSkeleton label="Loading review…" />);
    expect(screen.getByText('Loading review…')).toBeInTheDocument();
  });
});
