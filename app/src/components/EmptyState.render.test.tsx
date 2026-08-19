// B7 (DEC-678 amendment): EmptyState is the ONE component that owns the
// fresh-vs-filtered split -- these tests cover both variants' shape and the
// two enforcement rules the component asserts rather than trusting callers
// to respect (variant 'filtered' never renders `action`; variant 'fresh'
// never renders `escape`), plus that neither variant ever renders a
// disabled control.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { EmptyState } from './EmptyState';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_CSS = readFileSync(join(HERE, '..', 'styles.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector -- same helper as TracksRoomsPanel.render.test.tsx. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

afterEach(() => {
  cleanup();
});

describe('EmptyState', () => {
  it('fresh: renders what + a real (non-disabled) primary action, no reason when omitted', () => {
    render(
      <MemoryRouter>
        <EmptyState variant="fresh" what="No review plans yet" action={{ label: 'New plan', to: '/review/plans/new' }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('No review plans yet')).toBeInTheDocument();
    const action = screen.getByRole('link', { name: 'New plan' });
    expect(action).not.toHaveAttribute('disabled');
    expect(action).toHaveAttribute('href', '/review/plans/new');
    expect(screen.queryByText(/optional reason/)).not.toBeInTheDocument();
  });

  it('fresh: renders `reason` only when supplied', () => {
    const { rerender } = render(
      <MemoryRouter>
        <EmptyState variant="fresh" what="Nothing has been sent yet" action={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Nothing has been sent yet')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <EmptyState variant="fresh" what="Nothing has been sent yet" reason="Compose your first send" action={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Compose your first send')).toBeInTheDocument();
  });

  it('filtered: renders what + reason + a real (non-disabled) escape link, never a primary action button', () => {
    render(
      <MemoryRouter>
        <EmptyState
          variant="filtered"
          what="No one in Contacted"
          reason="Move a card into Contacted to see it here."
          escape={{ label: 'Clear filter', onClick: () => {} }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('No one in Contacted')).toBeInTheDocument();
    expect(screen.getByText('Move a card into Contacted to see it here.')).toBeInTheDocument();
    const escape = screen.getByRole('button', { name: 'Clear filter' });
    expect(escape).not.toHaveAttribute('disabled');
    // No primary action anywhere.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(?!Clear filter$).+/ })).not.toBeInTheDocument();
  });

  it('enforces: variant "filtered" throws rather than silently dropping `action`', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <EmptyState variant="filtered" what="No one in Contacted" action={{ label: 'New plan', onClick: () => {} }} />
        </MemoryRouter>,
      ),
    ).toThrow(/filtered/);
  });

  it('enforces: variant "fresh" throws rather than silently dropping `escape`', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <EmptyState variant="fresh" what="Nothing has been sent yet" escape={{ label: 'Clear filter', onClick: () => {} }} />
        </MemoryRouter>,
      ),
    ).toThrow(/fresh/);
  });

  // DEC-370 amendment (wave 47): `secondary` is permitted ONLY on 'fresh'.
  it('fresh: renders `secondary` beside the primary action as a tertiary link', () => {
    render(
      <MemoryRouter>
        <EmptyState
          variant="fresh"
          what="Nothing needs you yet"
          action={{ label: 'Set up the call for papers', to: '/settings?section=cfp' }}
          secondary={{ label: 'Add a speaker by hand ›', to: '/speakers' }}
        />
      </MemoryRouter>,
    );

    const primary = screen.getByRole('link', { name: 'Set up the call for papers' });
    expect(primary).toHaveAttribute('href', '/settings?section=cfp');
    const secondary = screen.getByRole('link', { name: 'Add a speaker by hand ›' });
    expect(secondary).toHaveAttribute('href', '/speakers');
    expect(secondary).not.toHaveAttribute('disabled');
  });

  it('enforces: variant "filtered" throws rather than silently dropping `secondary`', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <EmptyState
            variant="filtered"
            what="No one in Contacted"
            secondary={{ label: 'Add a speaker by hand ›', to: '/speakers' }}
          />
        </MemoryRouter>,
      ),
    ).toThrow(/filtered/);
  });

  it('never renders a disabled control on either variant', () => {
    const { rerender, container } = render(
      <MemoryRouter>
        <EmptyState variant="fresh" what="No review plans yet" action={{ label: 'New plan', onClick: () => {} }} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[disabled]')).toBeNull();

    rerender(
      <MemoryRouter>
        <EmptyState variant="filtered" what="No one in Contacted" escape={{ label: 'Clear filter', onClick: () => {} }} />
      </MemoryRouter>,
    );
    expect(container.querySelector('[disabled]')).toBeNull();
  });

  // DEC-370 amendment: the zero-state's `what` headline and `reason` line
  // are a display register (~24px headline / 16px reason), not the shell's
  // 15px/14px small-print register -- pinned here so a future edit to
  // .chq-empty-what/.chq-empty-reason can't quietly shrink them back down.
  it('CSS contract: .chq-empty-what is a 24px display headline, .chq-empty-reason is a 16px reason line', () => {
    const whatBody = topLevelRuleBody(STYLES_CSS, '.chq-empty-what');
    expect(whatBody).toMatch(/font-size:\s*24px/);
    expect(whatBody).toMatch(/font-weight:\s*600/);
    expect(whatBody).toMatch(/font-family:\s*var\(--chq-font-display\)/);

    const reasonBody = topLevelRuleBody(STYLES_CSS, '.chq-empty-reason');
    expect(reasonBody).toMatch(/font-size:\s*16px/);
  });
});
