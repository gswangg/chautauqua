// DEC_728 wave-25 (USER RULING D19, part 7): two verified defects in the
// switch-banner mechanism, both exercised here under a real MemoryRouter
// (every other test in this file's siblings drives the hook's non-router
// fallback -- window.history.pushState + a plain window.location read --
// so this file is the first to prove the REACTIVE useLocation() path too).
//
// Defect 1: the resolve effect cleared `error` at the start of the read
// that can replace it but never `switchInfo` -- a later navigation with no
// `eventId` in the URL took the `!fromUrl && !fromStorage` branch, which
// never called setSwitchInfo, so a banner from an earlier navigation
// stayed on screen (EventSwitcher lives in the persistent shell).
//
// Defect 2: navigation identity was `location.search` alone, so
// `/speakers?eventId=B` and `/contacts?eventId=B` were treated as the SAME
// navigation and a newly-mounted instance on the second page replayed the
// first page's frozen (fromUrl, fromStorage) pair, re-announcing a switch
// that did not happen there. Navigation identity is now `pathname + search`.
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { resetEventsCacheForTests, resetInitialStoredIdForTests } from './useCurrentEvent';
import { EventSwitchBanner } from '../components/EventSwitchBanner';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

const STORAGE_KEY = 'chq.currentEventId';
const originalLocation = window.location;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  // The cache is scoped to one real page load -- a render-test suite
  // doesn't get that between `it()` blocks in this file.
  resetEventsCacheForTests();
  resetInitialStoredIdForTests();
});

// jsdom's window.location.assign is non-configurable on the Location
// instance -- replace the whole `window.location` object with a stub that
// carries a spy assign(), mirroring useCurrentEvent.render.test.tsx.
function stubLocationAssign(): ReturnType<typeof vi.fn> {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignSpy },
  });
  return assignSpy;
}

/** Renders EventSwitchBanner under a real MemoryRouter and exposes the
 * router's navigate() so a test can drive a client-side navigation --
 * pathname and/or search change with no full page reload -- exactly like
 * RosterPanel's CSV-import link or AddToEventModal's "View in Speakers"
 * link do in the real app. */
function NavBanner({ onNavigateReady }: { onNavigateReady: (navigate: NavigateFunction) => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    onNavigateReady(navigate);
  }, [navigate, onNavigateReady]);
  return <EventSwitchBanner />;
}

const EVENTS = listEnvelope([
  { id: 'ev-1', name: 'Alpha Conf' },
  { id: 'ev-2', name: 'Beta Summit' },
]);

describe('DEC_728 (D19) switch banner under a real router: stale state and navigation identity', () => {
  it('a URL eventId equal to the stored context renders no banner', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({ 'GET /api/v1/events': EVENTS });

    render(
      <MemoryRouter initialEntries={['/speakers?eventId=ev-1']}>
        <EventSwitchBanner />
      </MemoryRouter>,
    );

    // Give the switch-resolution effect a chance to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a differing eventId renders exactly one banner, and its restore link restores the prior context', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({ 'GET /api/v1/events': EVENTS });

    render(
      <MemoryRouter initialEntries={['/speakers?eventId=ev-2']}>
        <EventSwitchBanner />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(1);
    });
    expect(screen.getByText('Switched to Beta Summit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Alpha Conf' })).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-2');

    const assignSpy = stubLocationAssign();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Alpha Conf' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-1');
    expect(assignSpy).toHaveBeenCalledTimes(1);
  });

  it('after a switch, a second client-side navigation shows no banner, and a pathname-only change does not re-announce', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({ 'GET /api/v1/events': EVENTS });

    let navigate: NavigateFunction | null = null;

    render(
      <MemoryRouter initialEntries={['/speakers?eventId=ev-2']}>
        <NavBanner
          onNavigateReady={(nav) => {
            navigate = nav;
          }}
        />
      </MemoryRouter>,
    );

    // First navigation: URL eventId (ev-2) differs from the stored context
    // (ev-1) -- exactly one banner, and the write-through lands ev-2 in
    // storage.
    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(1);
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-2');

    // Second navigation: client-side (no reload), to a DIFFERENT pathname
    // but the SAME eventId that is already the stored context. Defect 2:
    // pre-fix, `/contacts?eventId=ev-2` keyed the SAME map entry as
    // `/speakers?eventId=ev-2` (search alone), so this instance would
    // replay the first navigation's frozen (fromStorage: 'ev-1') pair and
    // wrongly re-announce a switch. Defect 1: even without that, the prior
    // switchInfo must not simply linger.
    expect(navigate).not.toBeNull();
    navigate!('/contacts?eventId=ev-2');

    await waitFor(() => {
      expect(screen.queryAllByRole('status')).toHaveLength(0);
    });
    // Give the background reconcile a further chance to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-2');
  });
});
