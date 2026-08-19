// DEC-024 amendment (wave 51): one reader for "which event am I on" --
// useCurrentEvent reconciles the stored/URL id against the caller's own
// /events list and self-heals a stale id (previous persona, other org, a
// deleted event), sharing the fetch with EventSwitcher via the module-level
// loadEventsOnce() cache so mounting both costs one round trip.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useCurrentEvent, resetEventsCacheForTests } from './useCurrentEvent';
import { EventSwitcher } from '../components/EventSwitcher';
import { EventSwitchBanner } from '../components/EventSwitchBanner';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

const STORAGE_KEY = 'chq.currentEventId';
const originalLocation = window.location;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  window.history.pushState({}, '', '/admin');
  // The cache is scoped to one real page load (a full navigation) -- a
  // render test suite doesn't get that between `it()` blocks in this file.
  resetEventsCacheForTests();
});

// jsdom's window.location.assign is non-configurable on the Location
// instance, so vi.spyOn(window.location, 'assign') throws "Cannot redefine
// property" -- replace the whole `window.location` object with a stub that
// carries a spy assign() (mirrors useMe.render.test.tsx's pattern),
// restored in afterEach above.
function stubLocationAssign(): ReturnType<typeof vi.fn> {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignSpy },
  });
  return assignSpy;
}

describe('useCurrentEvent reconcile', () => {
  it('replaces a stored id absent from /events and persists the correction', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'stale-id');
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    const { result } = renderHook(() => useCurrentEvent());

    // Immediate: the id already in play, no blocking wait.
    expect(result.current.eventId).toBe('stale-id');
    expect(result.current.loading).toBe(false);

    await waitFor(() => {
      expect(result.current.eventId).toBe('ev-1');
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-1');
  });

  it('leaves a matching stored id untouched (no spurious write)', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    const { result } = renderHook(() => useCurrentEvent());

    expect(result.current.eventId).toBe('ev-1');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.eventId).toBe('ev-1');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-1');
  });

  it('a rejected /events leaves the stored id in place (fail soft)', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'ev-9');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network blip');
      }),
    );

    const { result } = renderHook(() => useCurrentEvent());

    expect(result.current.eventId).toBe('ev-9');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.eventId).toBe('ev-9');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-9');
  });

  it('an empty-response /events leaves the stored id in place (fail soft)', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'ev-9');
    mockApi({ 'GET /api/v1/events': listEnvelope([]) });

    const { result } = renderHook(() => useCurrentEvent());

    expect(result.current.eventId).toBe('ev-9');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.eventId).toBe('ev-9');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-9');
  });
});

describe('useCurrentEvent + EventSwitcher share the /events cache', () => {
  it('issues exactly one /events request when both are mounted on the same page', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    const fetchMock = mockApi({
      'GET /api/v1/me': { userId: 'u-1', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      'GET /api/v1/events': listEnvelope([{ id: 'ev-1', name: 'Alpha Conf' }]),
    });

    function Harness() {
      useCurrentEvent();
      return <EventSwitcher />;
    }

    render(<Harness />);

    await waitFor(() => screen.getByText('Alpha Conf'));
    // Give the hook's own background reconcile a chance to land too.
    await new Promise((resolve) => setTimeout(resolve, 20));

    const eventsCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/v1/events'),
    ).length;
    expect(eventsCalls).toBe(1);
  });
});

// DEC-728 amendment (wave 108, USER RULING D19): a cross-event switch is
// explicit, never silent. The URL write-through stays, but the moment a
// URL eventId OVERWRITES a DIFFERENT stored context, EventSwitchBanner
// announces it with a one-click restore. Pinned two-directionally: equal
// ids show nothing, differing ids show exactly one banner, and the
// restore link writes the prior id back and lands the caller on the same
// page with `eventId` stripped.
describe('DEC-728 (D19) cross-event switch banner', () => {
  it('a URL eventId equal to the stored context shows no banner', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-1');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitchBanner />);

    // Give the switch-resolution effect (which shares the reconcile fetch)
    // a chance to land before asserting the negative.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a URL eventId that differs from the stored context shows exactly one banner naming both events', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-2');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitchBanner />);

    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(1);
    });
    expect(screen.getByText('Switched to Beta Summit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Alpha Conf' })).toBeInTheDocument();
    // The URL write-through itself is unchanged: storage now holds the URL id.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-2');
  });

  it('renders nothing (no id shown in place of a name) until both events are resolved from /events', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-2');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    // 'ev-1' (the prior stored id) is absent from the caller's own /events
    // list -- the banner must never fall back to showing the raw id.
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-2', name: 'Beta Summit' }]),
    });

    render(<EventSwitchBanner />);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/ev-1/)).not.toBeInTheDocument();
  });

  it('the restore link writes the prior id back to storage and lands on the same page with eventId stripped', async () => {
    window.history.pushState({}, '', '/admin/settings?eventId=ev-2&tab=tracks');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitchBanner />);
    await screen.findByRole('button', { name: 'Back to Alpha Conf' });

    const assignSpy = stubLocationAssign();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Alpha Conf' }));

    // Assert the storage value, not just that a click handler exists.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-1');
    expect(assignSpy).toHaveBeenCalledTimes(1);
    const target = assignSpy.mock.calls[0]![0] as string;
    expect(target).toBe('/admin/settings?tab=tracks');

    // Simulate the landed navigation and assert the RESOLVED event, not
    // merely the stored id: a fresh mount at the restored URL (storage now
    // deciding, since eventId is gone from the URL) must resolve back to
    // the prior event.
    resetEventsCacheForTests();
    // Restore the real Location before navigating -- the stub above is a
    // frozen snapshot that pushState can't update.
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    window.history.pushState({}, '', target);
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });
    const { result } = renderHook(() => useCurrentEvent());
    expect(result.current.eventId).toBe('ev-1');
    await waitFor(() => {
      expect(result.current.switchInfo).toBeNull();
    });
  });
});
