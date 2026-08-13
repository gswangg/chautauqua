// DEC-024 amendment (wave 51): one reader for "which event am I on" --
// useCurrentEvent reconciles the stored/URL id against the caller's own
// /events list and self-heals a stale id (previous persona, other org, a
// deleted event), sharing the fetch with EventSwitcher via the module-level
// loadEventsOnce() cache so mounting both costs one round trip.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useCurrentEvent, resetEventsCacheForTests } from './useCurrentEvent';
import { EventSwitcher } from '../components/EventSwitcher';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

const STORAGE_KEY = 'chq.currentEventId';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  // The cache is scoped to one real page load (a full navigation) -- a
  // render test suite doesn't get that between `it()` blocks in this file.
  resetEventsCacheForTests();
});

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
