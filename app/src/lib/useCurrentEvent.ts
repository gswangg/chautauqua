// DEC-024: SPA shared "current event" hook. Resolution order: ?eventId URL
// param -> localStorage 'chq.currentEventId' (same key the submissions-local
// useCurrentEventId.ts stand-in uses) -> fetch GET /api/v1/events and take
// items[0].id, persisting it. Errors surface loudly (no silent null).
//
// DEC-024 amendment (wave 51): a stored/URL id is not an answer until
// /events confirms it. Once an id is in play (URL or storage) the hook
// reconciles it against the caller's own /events list -- via the single
// pure decision in eventSwitcherState.reconcileStoredEventId -- and
// self-heals a stale id (previous persona, other org, a deleted event) by
// persisting the corrected id. That reconcile is best-effort: it fails
// soft on a rejected or empty-response /events, leaving the id already in
// play untouched, because a network blip must not evict a valid selection.
// /events itself is fetched at most once per page load, via the
// module-level in-flight promise cache exported below as loadEventsOnce —
// EventSwitcher consumes the same cache so mounting both costs one round
// trip (SPEC §7), not two.
//
// DEC-728 amendment (wave 108, USER RULING D19): the URL write-through
// stays (page and context move together, no transient/split-view state),
// but the moment a URL eventId OVERWRITES a DIFFERENT stored context, that
// is a silent cross-event switch and must announce itself. The hook
// captures the pre-overwrite stored id and, once both ids' names are known
// from loadEventsOnce() (never an id in place of a name), exposes
// `switchInfo` -- the prior event, the new event, and a `restore()` that
// writes the prior id back to storage and re-lands the caller on the same
// page with the `eventId` param stripped (so storage, not the URL, decides
// on the next read).
//
// DEC-728 wave-117 amendment (USER RULING D19, part 2): an unresolvable URL
// eventId must never silently evict the stored context. Three clauses,
// folded into the one `switchInfo` channel above rather than a second
// banner mechanism (DEC-613, one vocabulary):
//  (a) fromUrl absent from /events, a DIFFERENT priorStoredId resolves --
//      restore the prior id (storage + state) and announce it as `kept`.
//      No restore() link: there is nothing to go back to.
//  (b) items[0] is the fallback ONLY when there was no prior stored
//      context, or the prior stored id is itself unresolvable --
//      reconcileStoredEventId must never heal a URL-sourced id over a
//      resolving prior stored id (that heal is done explicitly by (a)).
//  (c) fromUrl resolves but priorStoredId no longer does -- still
//      announce the switch (target name only, no Back link) instead of
//      passing silently.
//
// DEC-728 wave-138 amendment (USER RULING D19, part 3): the banner was
// unreachable by mount order. A per-instance read of localStorage inside the
// effect is unreliable -- in the real app PhoneTabBar -> useNavExceptions ->
// useCurrentEvent runs on the FIRST commit and immediately overwrites
// localStorage with fromUrl, while EventSwitchBanner's own useCurrentEvent
// instance only first renders after useMe()'s async /me round trip -- by
// then fromStorage === fromUrl and priorStoredId can never be computed, so
// the banner never renders. A hook that both reads a prior value and writes
// over it must capture the prior ONCE per document, not once per instance:
// the first instance to render freezes the true pre-overwrite (fromUrl,
// fromStorage) pair, and every later instance sharing the SAME navigation
// reads that frozen pair instead of window directly.
//
// DEC-728 wave-143 amendment (USER RULING D19, part 4): "once per document"
// was too coarse. A react-router CLIENT-SIDE navigation (a <Link>/navigate()
// call that changes route without a full page reload -- e.g. RosterPanel's
// `/contacts?import=1&eventId=...` and AddToEventModal's
// `/speakers?eventId=...`) carries a NEW eventId across the same document,
// but the module-level snapshot above was captured once, forever, on the
// FIRST navigation of the page load -- every later navigation's fromUrl was
// silently ignored, and the D19 banner could never fire on a client-side
// switch. The snapshot is now keyed by the navigation's location.search in
// the module-level `navigationContexts` map below, reference-counted by the
// hook instances currently mounted for that search: while at least one
// instance for a given search is alive, every instance -- regardless of
// mount order, preserving the wave-138 guarantee verbatim -- reads the same
// frozen pair; once the last one unmounts (a real navigation away, or a
// render test's cleanup() between `it()` blocks reusing this module) the
// entry is dropped, so the next mount for that same search string (a fresh
// navigation, or a fresh test) captures anew instead of replaying stale
// state.
import { useEffect, useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { apiList, ApiError } from './api';
import { reconcileStoredEventId } from '../components/eventSwitcherState';
import { DEC_728 } from '../../../src/decisions';

void DEC_728; // wave-117 amendment: unresolvable URL eventId never evicts stored context

const STORAGE_KEY = 'chq.currentEventId';

export type EventSwitchInfo =
  | { kind: 'switched'; fromEvent: EventListItem; toEvent: EventListItem; restore: () => void }
  | { kind: 'switched-no-restore'; toEvent: EventListItem }
  | { kind: 'kept'; keptEvent: EventListItem };

export interface UseCurrentEventResult {
  eventId: string | null;
  loading: boolean;
  error?: string;
  switchInfo: EventSwitchInfo | null;
}

export interface EventListItem {
  id: string;
  name: string;
}

let eventsPromise: Promise<EventListItem[]> | null = null;

interface NavigationContext {
  fromUrl: string | null;
  fromStorage: string | null;
}

interface NavigationContextEntry {
  context: NavigationContext;
  refCount: number;
}

// DEC-728 wave-143: keyed by location.search (one entry per navigation),
// reference-counted by the hook instances currently mounted for that
// search. See the file-header amendment above for why this replaced the
// wave-138 "once per document" singleton.
const navigationContexts = new Map<string, NavigationContextEntry>();

function captureNavigationContext(search: string): NavigationContext {
  let entry = navigationContexts.get(search);
  if (!entry) {
    entry = {
      context: {
        fromUrl: new URLSearchParams(search).get('eventId'),
        fromStorage: window.localStorage.getItem(STORAGE_KEY),
      },
      refCount: 0,
    };
    navigationContexts.set(search, entry);
  }
  return entry.context;
}

function acquireNavigationContext(search: string): void {
  const entry = navigationContexts.get(search);
  if (!entry) throw new Error('acquireNavigationContext: no captured context for this search');
  entry.refCount += 1;
}

function releaseNavigationContext(search: string): void {
  const entry = navigationContexts.get(search);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) navigationContexts.delete(search);
}

/** The stored event id as it stood before ANY useCurrentEvent() instance
 * sharing this navigation overwrote it -- an alias onto the same captured
 * pair above (kept as its own named accessor, mirroring the pre-wave-143
 * shape) so the D19 restore/kept logic reads self-documenting call sites. */
function getInitialStoredId(search: string): string | null {
  return captureNavigationContext(search).fromStorage;
}

/** Fetches GET /api/v1/events at most once per page load, sharing the
 * in-flight (or settled) promise across every caller — the hook's own
 * reconcile pass and EventSwitcher's listing both go through this. */
export function loadEventsOnce(): Promise<EventListItem[]> {
  if (!eventsPromise) {
    eventsPromise = apiList<EventListItem>('/events').then((res) => res.items);
  }
  return eventsPromise;
}

/** Test-only seam: the cache is scoped to one real page load (a browser
 * full-navigation, e.g. EventSwitcher's switchTo), which a render test
 * suite doesn't get between `it()` blocks in the same file — call this in
 * `afterEach` to keep tests isolated. Never called from production code. */
export function resetEventsCacheForTests(): void {
  eventsPromise = null;
  navigationContexts.clear();
}

/** Test-only seam, mirroring resetEventsCacheForTests() above: a render
 * test suite reuses the module across `it()` blocks in the same file, but
 * each real navigation only ever captures a given search once while
 * instances for it are mounted. Never called from production code. */
export function resetInitialStoredIdForTests(): void {
  navigationContexts.clear();
}

/** Resolves the current location.search, reactively when a react-router
 * `<Router>` ancestor exists (so a client-side navigation -- pushState via
 * <Link>/navigate(), no full document reload -- re-runs the resolve effect
 * below with the new search) and falling back to a plain, non-reactive
 * `window.location.search` read otherwise (the render tests that call this
 * hook, or render EventSwitchBanner, with no MemoryRouter ancestor).
 * `useInRouterContext()` is fixed for the lifetime of a given component
 * instance -- a tree either has a Router ancestor or it doesn't, for as
 * long as that instance stays mounted -- so conditioning the useLocation()
 * call on it does not violate React's same-hooks-every-render invariant for
 * that instance. */
function useLocationSearch(): string {
  const inRouterContext = useInRouterContext();
  // eslint-disable-next-line react-hooks/rules-of-hooks -- see comment above.
  const location = inRouterContext ? useLocation() : null;
  return inRouterContext ? location!.search : window.location.search;
}

export function useCurrentEvent(): UseCurrentEventResult {
  const search = useLocationSearch();
  const { fromUrl: initialFromUrl, fromStorage: initialFromStorage } = captureNavigationContext(search);
  const idInPlay = initialFromUrl ?? initialFromStorage ?? null;

  const [eventId, setEventId] = useState<string | null>(idInPlay);
  const [loading, setLoading] = useState(idInPlay === null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [switchInfo, setSwitchInfo] = useState<EventSwitchInfo | null>(null);

  useEffect(() => {
    // DEC-728 wave-143: this instance is now sharing the navigation keyed
    // by `search` -- hold a reference for as long as it's mounted for that
    // search, releasing (and possibly dropping the frozen snapshot) on
    // unmount or on a search change, so the NEXT navigation captures fresh
    // rather than replaying this one's pre-overwrite pair.
    acquireNavigationContext(search);
    let cancelled = false;

    // DEC-856: clear at the start of the read that can replace it, matching
    // the discipline applied to the other page-level error banners.
    setError(undefined);
    const { fromUrl, fromStorage } = captureNavigationContext(search);
    if (!fromUrl && !fromStorage) {
      setLoading(true);
      loadEventsOnce()
        .then((items) => {
          if (cancelled) return;
          const first = items[0];
          if (!first) {
            setError('No events exist yet.');
            return;
          }
          window.localStorage.setItem(STORAGE_KEY, first.id);
          setEventId(first.id);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiError ? err.message : 'Failed to resolve current event');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
        releaseNavigationContext(search);
      };
    }

    // DEC-728 amendment (D19): a URL id that differs from what was already
    // stored is a silent cross-event switch -- capture the pre-overwrite
    // id *before* the write below replaces it, so it survives to name
    // resolution. Read from the navigation-scoped snapshot (wave-143
    // amendment above), not the per-instance `fromStorage` closed over at
    // render time: a sibling instance sharing this navigation may have
    // already overwritten storage by the time THIS instance's effect runs.
    const priorStored = getInitialStoredId(search);
    const priorStoredId = fromUrl && priorStored && fromUrl !== priorStored ? priorStored : null;

    // An id is already in play (URL wins over storage) -- return it
    // immediately, no blocking wait.
    if (fromUrl) {
      window.localStorage.setItem(STORAGE_KEY, fromUrl);
      setEventId(fromUrl);
    } else {
      setEventId(fromStorage);
    }
    setLoading(false);

    // Reconcile in the background: self-heal a stale id, fail soft on any
    // fetch problem. The same fetch resolves the switch banner's two
    // names, since both need the caller's own /events list.
    const idToReconcile = (fromUrl ?? fromStorage) as string;
    loadEventsOnce()
      .then((items) => {
        if (cancelled) return;
        if (priorStoredId) {
          const fromEvent = items.find((item) => item.id === priorStoredId);
          const toEvent = items.find((item) => item.id === fromUrl);
          // Render nothing until the names in play are known -- never show
          // an id in place of a name.
          if (fromEvent && toEvent) {
            setSwitchInfo({
              kind: 'switched',
              fromEvent,
              toEvent,
              restore: () => {
                window.localStorage.setItem(STORAGE_KEY, fromEvent.id);
                const url = new URL(window.location.href);
                url.searchParams.delete('eventId');
                window.location.assign(`${url.pathname}${url.search}${url.hash}`);
              },
            });
          } else if (toEvent && !fromEvent) {
            // DEC-728 wave-117 (c): the URL id resolves but the prior
            // stored id no longer does -- still announce, nothing to
            // offer a restore to.
            setSwitchInfo({ kind: 'switched-no-restore', toEvent });
          } else if (!toEvent && fromEvent) {
            // DEC-728 wave-117 (a)+(b): the URL id does NOT resolve and a
            // DIFFERENT prior stored id does -- restore it rather than
            // silently evicting it for items[0], and say so. Return before
            // the reconcile call below, which would otherwise heal the
            // unresolvable fromUrl to items[0].
            window.localStorage.setItem(STORAGE_KEY, fromEvent.id);
            setEventId(fromEvent.id);
            setSwitchInfo({ kind: 'kept', keptEvent: fromEvent });
            return;
          }
        }
        if (items.length === 0) return;
        const { eventId: reconciled, changed } = reconcileStoredEventId(items, idToReconcile);
        if (changed && reconciled) {
          window.localStorage.setItem(STORAGE_KEY, reconciled);
          setEventId(reconciled);
        }
      })
      .catch(() => {
        // Fail soft: keep the id already in play. A network blip must not
        // evict a valid selection.
      });
    return () => {
      cancelled = true;
      releaseNavigationContext(search);
    };
    // Re-runs whenever the navigation's search changes -- a client-side
    // react-router switch (RosterPanel's CSV-import link, AddToEventModal's
    // "View in Speakers" link) carries a new eventId without a full page
    // reload, and this instance must resolve it fresh rather than replaying
    // whatever search it first mounted with.
  }, [search]);

  return { eventId, loading, error, switchInfo };
}
