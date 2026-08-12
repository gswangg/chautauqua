// DEC-695 (mandate item 33): a throw during a routed page's render must
// never unmount the shell into an empty <body>. This boundary catches it,
// surfaces the caught error's message verbatim (fail loudly, never a
// sanitised "friendly nothing"), and offers a reset control.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { RouteErrorBoundary } from './RouteErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('kaboom: undefined has no length');
  }
  return <div>safe content</div>;
}

// Throws on render until externally told to stop. React re-invokes a
// throwing render function more than once per commit attempt even outside
// StrictMode (to confirm the error before handing off to the boundary), so
// this flips a module-level switch rather than counting invocations.
let recovered = false;
function ThrowsUntilRecovered() {
  if (!recovered) {
    throw new Error('kaboom: undefined has no length');
  }
  return <div>recovered content</div>;
}

function ResettableBomb() {
  return (
    <RouteErrorBoundary>
      <ThrowsUntilRecovered />
    </RouteErrorBoundary>
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React itself also logs the caught error to console.error during
  // render; silence that noise but still let componentDidCatch's own
  // console.error call happen so we can assert on it.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  recovered = false;
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

describe('RouteErrorBoundary', () => {
  it('renders the designed error state, with the caught message visible, never an empty container', () => {
    const { container } = render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Bomb shouldThrow />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByText('kaboom: undefined has no length')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Overview/ })).toHaveAttribute('href', '/overview');
    expect(container).not.toBeEmptyDOMElement();
  });

  it('console.errors the caught error and its component stack', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Bomb shouldThrow />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    const ownCall = consoleErrorSpy.mock.calls.find(
      (call) => call[0] instanceof Error && call[0].message === 'kaboom: undefined has no length',
    );
    expect(ownCall).toBeDefined();
    expect(typeof ownCall?.[1]).toBe('string');
  });

  it('does not render the error state when children do not throw', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Bomb shouldThrow={false} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText('safe content')).toBeInTheDocument();
    expect(screen.queryByText('Something broke')).not.toBeInTheDocument();
  });

  it('"Try again" resets the boundary and re-renders children', () => {
    render(
      <MemoryRouter>
        <ResettableBomb />
      </MemoryRouter>,
    );

    expect(screen.getByText('Something broke')).toBeInTheDocument();

    recovered = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.queryByText('Something broke')).not.toBeInTheDocument();
    expect(screen.getByText('recovered content')).toBeInTheDocument();
  });
});
