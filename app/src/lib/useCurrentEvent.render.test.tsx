// DEC-024 amendment (wave 51): one reader for "which event am I on" --
// useCurrentEvent reconciles the stored/URL id against the caller's own
// /events list and self-heals a stale id (previous persona, other org, a
// deleted event), sharing the fetch with EventSwitcher via the module-level
// loadEventsOnce() cache so mounting both costs one round trip.
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useCurrentEvent, resetEventsCacheForTests, resetInitialStoredIdForTests } from './useCurrentEvent';
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
  resetInitialStoredIdForTests();
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

// DEC-728 wave-138: the banner's own useCurrentEvent instance was
// unreachable by mount order -- the FIRST instance to render (mirroring
// PhoneTabBar's useNavExceptions, which commits before useMe() resolves)
// writes localStorage over the pre-overwrite value before the banner's own
// instance ever gets to compute priorStoredId. documentInitialContext()
// must freeze (fromUrl, fromStorage) once per document so a SECOND,
// later-mounting instance still sees the true prior pair.
describe('DEC-728 (D19) capture is once-per-document, not once-per-instance', () => {
  it('a second instance mounted after the first has already overwritten storage still sees switched', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-2');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    function FirstInstance() {
      // Mirrors PhoneTabBar -> useNavExceptions -> useCurrentEvent: mounts
      // immediately, its effect fires on the first commit and overwrites
      // localStorage with fromUrl before anything else runs.
      useCurrentEvent();
      return null;
    }

    function SecondInstance({ ready }: { ready: boolean }) {
      // Mirrors EventSwitchBanner, whose mount is gated behind useMe()'s
      // async /me round trip -- it only calls useCurrentEvent() once
      // something else (an async flip) says it's ready.
      const result = useCurrentEvent();
      if (!ready) return null;
      if (!result.switchInfo) return <div data-testid="second-pending" />;
      return <div data-testid="second-switch-kind">{result.switchInfo.kind}</div>;
    }

    function Harness() {
      const [ready, setReady] = useState(false);
      useEffect(() => {
        // Resolve asynchronously, after FirstInstance's effect has already
        // run and overwritten localStorage -- the real gating condition.
        Promise.resolve().then(() => setReady(true));
      }, []);
      return (
        <>
          <FirstInstance />
          <SecondInstance ready={ready} />
        </>
      );
    }

    render(<Harness />);

    // By the time SecondInstance's own instance first rendered, a naive
    // per-instance read of window would see fromStorage === fromUrl
    // ('ev-2' === 'ev-2') and never compute a switch. The frozen
    // documentInitialContext() must still show it as switched.
    await waitFor(() => {
      expect(screen.getByTestId('second-switch-kind')).toHaveTextContent('switched');
    });
  });

  it('restore() from a second-mounted instance writes the true prior id back', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-2');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    let capturedRestore: (() => void) | null = null;

    function FirstInstance() {
      useCurrentEvent();
      return null;
    }

    function SecondInstance({ ready }: { ready: boolean }) {
      const result = useCurrentEvent();
      if (ready && result.switchInfo?.kind === 'switched') {
        capturedRestore = result.switchInfo.restore;
      }
      return null;
    }

    function Harness() {
      const [ready, setReady] = useState(false);
      useEffect(() => {
        Promise.resolve().then(() => setReady(true));
      }, []);
      return (
        <>
          <FirstInstance />
          <SecondInstance ready={ready} />
        </>
      );
    }

    render(<Harness />);

    await waitFor(() => {
      expect(capturedRestore).not.toBeNull();
    });

    const assignSpy = stubLocationAssign();
    capturedRestore!();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-1');
    expect(assignSpy).toHaveBeenCalledTimes(1);
  });

  it('a URL eventId equal to the stored context yields no switchInfo from either instance', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-1');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    function FirstInstance() {
      const result = useCurrentEvent();
      return <div data-testid="first-switch">{String(result.switchInfo)}</div>;
    }

    function SecondInstance({ ready }: { ready: boolean }) {
      const result = useCurrentEvent();
      if (!ready) return null;
      return <div data-testid="second-switch">{String(result.switchInfo)}</div>;
    }

    function Harness() {
      const [ready, setReady] = useState(false);
      useEffect(() => {
        Promise.resolve().then(() => setReady(true));
      }, []);
      return (
        <>
          <FirstInstance />
          <SecondInstance ready={ready} />
        </>
      );
    }

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('second-switch')).toBeInTheDocument();
    });
    // Give the background reconcile a chance to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId('first-switch')).toHaveTextContent('null');
    expect(screen.getByTestId('second-switch')).toHaveTextContent('null');
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

  it('renders nothing (no id shown in place of a name) until the /events fetch settles', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-2');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    render(<EventSwitchBanner />);

    // Before the fetch settles there is no name to show yet.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/ev-1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ev-2/)).not.toBeInTheDocument();
  });

  // DEC-728 wave-117 (D19, clause c): the URL id resolves but the prior
  // stored id no longer does -- this used to pass silently ("today's
  // silent pass"); it must now still announce, just with no Back link
  // (there is nothing to go back to).
  it('a resolving URL eventId with an unresolvable prior stored id shows one banner, no Back link', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-2');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    // 'ev-1' (the prior stored id) is absent from the caller's own /events
    // list -- the banner must never fall back to showing the raw id.
    mockApi({
      'GET /api/v1/events': listEnvelope([{ id: 'ev-2', name: 'Beta Summit' }]),
    });

    render(<EventSwitchBanner />);

    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(1);
    });
    expect(screen.getByText('Switched to Beta Summit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back to/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/ev-1/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-2');
  });

  // DEC-728 wave-117 (D19, clauses a+b): the URL id does NOT resolve (a
  // stale/foreign/bookmarked link) while a DIFFERENT prior stored id
  // does -- the prior context must be kept, never silently evicted for
  // items[0].
  it('an unresolvable URL eventId with a resolving prior stored id keeps the prior context and names it', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-nonexistent');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    const { result } = renderHook(() => useCurrentEvent());

    // Immediately, the URL id is optimistically in play (write-through)...
    expect(result.current.eventId).toBe('ev-nonexistent');

    // ...but once /events resolves, the prior context is restored -- to
    // both state and storage -- and items[0] ('ev-1', coincidentally the
    // same event here) is never written as a side effect of a blind
    // fallback. Use a stored id that is NOT items[0] to prove it's the
    // prior id being restored, not an accidental fallback match.
    await waitFor(() => {
      expect(result.current.switchInfo).not.toBeNull();
    });
    expect(result.current.eventId).toBe('ev-1');
    expect(result.current.switchInfo).toEqual({
      kind: 'kept',
      keptEvent: { id: 'ev-1', name: 'Alpha Conf' },
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-1');

    render(<EventSwitchBanner />);
    await waitFor(() => {
      expect(screen.getByText('Kept Alpha Conf')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // Same clause, but the resolving prior id is NOT items[0] -- proves the
  // restore is genuinely the prior id, not a coincidental items[0] match.
  it('restores a resolving prior stored id that is not items[0], never falling back to items[0]', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-nonexistent');
    window.localStorage.setItem(STORAGE_KEY, 'ev-2');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    const { result } = renderHook(() => useCurrentEvent());

    await waitFor(() => {
      expect(result.current.switchInfo).not.toBeNull();
    });
    expect(result.current.eventId).toBe('ev-2');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ev-2');
  });

  // DEC-728 wave-138 amendment (D19, part 3): on the real page, a
  // non-banner useCurrentEvent() consumer (PhoneTabBar, via
  // useNavExceptions) mounts and commits its effect -- overwriting
  // storage with fromUrl -- BEFORE EventSwitchBanner ever mounts, because
  // EventSwitcher gates the banner behind an async useMe() identity fetch
  // that only resolves after the first commit. A per-instance read of
  // localStorage inside the effect loses this race and the banner never
  // renders. Mirrored here: NonBannerConsumer mounts synchronously and
  // writes storage in its effect; DelayedBanner mounts EventSwitchBanner
  // only after a microtask (standing in for the async loading gate).
  it('a sibling useCurrentEvent() consumer that mounts and writes storage first does not suppress the banner', async () => {
    window.history.pushState({}, '', '/admin?eventId=ev-2');
    window.localStorage.setItem(STORAGE_KEY, 'ev-1');
    mockApi({
      'GET /api/v1/events': listEnvelope([
        { id: 'ev-1', name: 'Alpha Conf' },
        { id: 'ev-2', name: 'Beta Summit' },
      ]),
    });

    function NonBannerConsumer() {
      useCurrentEvent();
      return null;
    }

    function DelayedBanner() {
      const [ready, setReady] = useState(false);
      // Stands in for EventSwitcher's `!loading && me?.role === 'organizer'`
      // gate: EventSwitchBanner only mounts after an async round trip
      // resolves, one or more render passes after NonBannerConsumer's
      // effect has already committed and written storage.
      useEffect(() => {
        Promise.resolve().then(() => setReady(true));
      }, []);
      if (!ready) return null;
      return <EventSwitchBanner />;
    }

    render(
      <>
        <NonBannerConsumer />
        <DelayedBanner />
      </>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(1);
    });
    expect(screen.getByText('Switched to Beta Summit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Alpha Conf' })).toBeInTheDocument();
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
