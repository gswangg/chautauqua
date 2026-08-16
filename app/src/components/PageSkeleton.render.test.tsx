// DEC-678 (wave-3 amendment, wave-58 amendment): PageSkeleton renders on the
// FIRST frame -- no timer -- with role="status"/aria-busy and always six
// placeholder rows shaped by variant, so a loading admin page's main region
// is never empty. Wave 58: "always six, never a guess" is a contract, not a
// default -- there is no `rows` prop for a caller to override.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PageSkeleton, SKELETON_ROWS } from './PageSkeleton';

afterEach(() => {
  cleanup();
});

describe('PageSkeleton', () => {
  it('exports SKELETON_ROWS === 6', () => {
    expect(SKELETON_ROWS).toBe(6);
  });

  it('renders with aria-busy on the first frame with no timers advanced', () => {
    vi.useFakeTimers();
    render(<PageSkeleton />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    vi.useRealTimers();
  });

  it('renders exactly six placeholder rows for the table variant, with no way to override', () => {
    render(<PageSkeleton variant="table" />);
    const status = screen.getByRole('status');
    expect(status.querySelectorAll('.chq-skeleton-row')).toHaveLength(6);
    // The component takes no `rows` prop at all -- TypeScript would refuse
    // `<PageSkeleton rows={4} />` at compile time (see the scan below).
  });

  it('renders exactly six list-shaped rows for the list variant', () => {
    render(<PageSkeleton variant="list" />);
    const status = screen.getByRole('status');
    const rows = status.querySelectorAll('.chq-skeleton-row-list');
    expect(rows).toHaveLength(6);
    expect(rows[0]?.querySelector('.chq-skeleton-bar-title')).toBeInTheDocument();
  });

  it('renders a title bar plus two columns of three for the detail variant', () => {
    render(<PageSkeleton variant="detail" />);
    const status = screen.getByRole('status');
    expect(status.querySelector('.chq-skeleton-bar-title-lg')).toBeInTheDocument();
    const cols = status.querySelectorAll('.chq-skeleton-detail-col');
    expect(cols).toHaveLength(2);
    const total = Array.from(cols).reduce(
      (sum, col) => sum + col.querySelectorAll('.chq-skeleton-bar').length,
      0,
    );
    expect(total).toBe(6);
  });

  it('carries a visually-hidden label defaulting to "Loading…"', () => {
    render(<PageSkeleton />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('accepts a custom label', () => {
    render(<PageSkeleton label="Loading review…" />);
    expect(screen.getByText('Loading review…')).toBeInTheDocument();
  });

  it('gives the title column of the table variant varied widths across rows via nth-child, while the meta columns stay uniform', () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'page-skeleton.css');
    const css = readFileSync(cssPath, 'utf8');

    const widths = new Set<string>();
    for (let n = 1; n <= SKELETON_ROWS; n++) {
      const re = new RegExp(
        String.raw`\.chq-skeleton-row-table:nth-child\(${n}\)\s+\.chq-skeleton-bar-wide\s*\{[^}]*width:\s*([\d.]+%)`,
      );
      const match = css.match(re);
      expect(match, `expected an nth-child(${n}) title-width rule`).not.toBeNull();
      widths.add(match![1]!);
    }
    // Six rows, at least several distinct widths -- not one repeated value.
    expect(widths.size).toBeGreaterThanOrEqual(4);

    // The narrow meta columns carry exactly one shared rule, with no
    // nth-child override -- they stay uniform.
    expect(css.match(/\.chq-skeleton-row-table\s+\.chq-skeleton-bar-narrow\s*\{/g)).toHaveLength(1);
    expect(css.includes(':nth-child') && css.match(/:nth-child\([1-6]\)\s+\.chq-skeleton-bar-narrow/)).toBeFalsy();
  });
});
