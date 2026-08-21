// DEC-728 wave-150 amendment (USER RULING D19, part 5): main.tsx wraps
// <App/> in <StrictMode>, whose dev double-invoke fires every effect as
// mount -> cleanup -> mount with NO intervening render. Before this wave,
// useCurrentEvent's navigation-context map deleted its frozen
// (fromUrl, fromStorage) pair the instant the liveness refcount hit zero --
// so the first StrictMode cleanup deleted the entry and the second mount's
// acquire threw on every single render of this hook in dev, a 100%
// reproducible crash that NO test in this repo caught because none of them
// rendered under StrictMode. This file is the repo's first StrictMode
// mount: it proves the hook survives the double-invoke, and that the D19
// switch-banner contract (no banner / exactly one banner / restore) still
// holds when every effect in the tree runs twice.
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useCurrentEvent, resetEventsCacheForTests, resetInitialStoredIdForTests } from './useCurrentEvent';
import { EventSwitchBanner } from '../components/EventSwitchBanner';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

const STORAGE_KEY = 'chq.currentEventId';
const originalLocation = window.location;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  window.history.pushState({}, '', '/admin');
  // Mirrors useCurrentEvent.render.test.tsx: the navigation-context/events
  // caches are scoped to one real page load, which a render-test suite
  // doesn't get between `it()` blocks in this file.
  resetEventsCacheForTests();
  resetInitialStoredIdForTests();
});

describe('useCurrentEvent under React StrictMode', () => {
  it('mounts inside <StrictMode> without throwing', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    function Consumer() {
      const result = useCurrentEvent();
      return <div data-testid="event-id">{String(result.eventId)}</div>;
    }

    // Before the fix: StrictMode's mount -> cleanup -> mount deleted the
    // frozen navigation context on cleanup and the second mount's
    // acquireNavigationContext() threw synchronously inside the effect --
    // this render() call itself is the assertion.
    expect(() => render(<Consumer />, { wrapper: StrictMode })).not.toThrow();

    await waitFor(() => {
      expect(screen.getByTestId('event-id')).toHaveTextContent('ev-1');
    });
  });

  it('a URL eventId equal to the stored context shows no switch banner under StrictMode', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-1');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitchBanner />, { wrapper: StrictMode });

    // Give the switch-resolution effect a chance to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a URL eventId that differs from the stored context shows exactly one banner under StrictMode, and restore() works', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-2');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitchBanner />, { wrapper: StrictMode });

    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(1);
    });
    expect(screen.getByText('Switched to Beta Summit')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-2');

    const assignSpy = stubLocationAssign();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Alpha Conf' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-1');
    expect(assignSpy).toHaveBeenCalledTimes(1);
  });
});

// jsdom's window.location.assign is non-configurable on the Location
// instance -- replace the whole `window.location` object with a stub that
// carries a spy assign(), mirroring useCurrentEvent.render.test.tsx's
// stubLocationAssign(). Restored in afterEach above.
function stubLocationAssign(): ReturnType<typeof vi.fn> {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignSpy },
  });
  return assignSpy;
}
