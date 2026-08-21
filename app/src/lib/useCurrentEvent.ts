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
// frozen pair.
//
// DEC-728 wave-150 amendment (USER RULING D19, part 5): tying the frozen
// pair's LIFETIME to the liveness refcount was a 100%-reproducible dev
// crash. React StrictMode double-invokes every effect as
// mount -> cleanup -> mount with NO intervening render: the first cleanup
// dropped refCount to 0 and DELETED the frozen pair, so the second mount's
// acquire found nothing captured and threw. The two concerns are now split:
// the frozen (fromUrl, fromStorage) pair is DOCUMENT-scoped, keyed by
// `search`, and is never deleted by a refcount reaching zero -- only the
// LIVENESS count drops on release, and acquireNavigationContext re-acquires
// the existing frozen pair instead of throwing -- the fail-loud throw is
// reserved for a `search` that was genuinely never captured at all (a real
// programmer error: acquiring before rendering). The two test-only reset
// seams still clear the whole map, so render-test isolation between `it()`
// blocks is unchanged.
//
// DEC-728 wave-158 amendment (USER RULING D19, part 6): a re-entered
// location.search is a NEW navigation. The wave-150 sentence above claimed
// "a real next navigation is either a different `search` key ... or a full
// page reload" -- that disjunction was false. A client-side navigation A ->
// B -> (back to) A is neither: it re-enters a `search` this document has
// already captured, so the stale wave-150 entry survived and was replayed,
// firing the D19 banner even though the URL eventId now equals the stored
// context -- exactly what the user's pin forbids. The frozen pair's
// identity is the NAVIGATION, not the search string. `lastCapturedKey`
// now tracks which key was captured most recently: a call to
// captureNavigationContext with a DIFFERENT key is unconditionally a new
// navigation, so any stale entry for that key is discarded and a fresh
// pair is captured from window; a call with the SAME key as last time is
// the same navigation continuing (another instance mounting, a re-render,
// or a StrictMode double-invoke) and returns the existing pair unchanged.
//
// DEC_728 wave-25 amendment (USER RULING D19, part 7, this file's two
// defects): (1) the resolve effect cleared `error` at the start of the read
// that can replace it but never `switchInfo` -- a later navigation with no
// `eventId` in the URL takes the `!fromUrl && !fromStorage` branch, which
// never calls setSwitchInfo, so a banner announced by an earlier navigation
// stayed on screen for the rest of the session (EventSwitcher lives in the
// persistent shell). `setSwitchInfo(null)` now sits beside `setError`,
// cleared for the identical reason: it is stale until THIS read either
// recomputes it or leaves it correctly empty. (2) navigation identity was
// `location.search` alone, so `/speakers?eventId=B` and `/contacts?eventId=B`
// keyed the SAME map entry -- a newly-mounted instance on the second page
// read the frozen pair captured by the first and re-announced a switch that
// did not happen on that page. Navigation identity is now `pathname +
// search`: every function below that used to take `search` takes the
// composite `key` instead, and `useLocationSearch` is renamed
// `useLocationKey` to match.
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
  /** DEC-728 wave-150: liveness only -- how many mounted hook instances are
   * currently sharing this navigation's frozen pair. Reaching zero does NOT
   * delete `context`; see the file-header amendment for why the pair itself
   * is document-scoped, not refcount-scoped. */
  liveCount: number;
}

// DEC-728 wave-143/150/25: keyed by `pathname + search` (one entry per
// navigation -- wave-25 widened the key from `search` alone, see the
// file-header amendment). The frozen `context` is document-scoped and
// outlives any individual mount; `liveCount` tracks how many instances are
// currently sharing it. See the file-header amendment above for why this
// replaced the wave-138 "once per document" singleton, and why wave-150
// stopped deleting the frozen pair on refcount 0.
const navigationContexts = new Map<string, NavigationContextEntry>();

// DEC-728 wave-158: which navigation key was most recently captured --
// identifies the CURRENT navigation. A capture call for a different key is
// always a new navigation, even if that key was seen before this document
// load; see the file-header amendment.
let lastCapturedKey: string | null = null;

function captureNavigationContext(key: string, search: string): NavigationContext {
  if (key !== lastCapturedKey) {
    // A re-entered key is a NEW navigation -- any prior entry for it is
    // stale (it belongs to an earlier navigation, not this one) and must
    // not be replayed. Discard it and capture fresh from window.
    navigationContexts.delete(key);
    navigationContexts.set(key, {
      context: {
        fromUrl: new URLSearchParams(search).get('eventId'),
        fromStorage: window.localStorage.getItem(STORAGE_KEY),
      },
      liveCount: 0,
    });
    lastCapturedKey = key;
  }
  const entry = navigationContexts.get(key);
  if (!entry) throw new Error('captureNavigationContext: invariant violated, entry must exist after capture');
  return entry.context;
}

function acquireNavigationContext(key: string): void {
  const entry = navigationContexts.get(key);
  if (!entry) throw new Error('acquireNavigationContext: no captured context for this key');
  entry.liveCount += 1;
}

function releaseNavigationContext(key: string): void {
  const entry = navigationContexts.get(key);
  if (!entry) return;
  entry.liveCount -= 1;
  // DEC-728 wave-150: the frozen pair is intentionally NOT deleted here --
  // see the file-header amendment. A StrictMode mount -> cleanup -> mount
  // (no intervening render) must re-acquire the SAME pair, not throw.
}

/** The stored event id as it stood before ANY useCurrentEvent() instance
 * sharing this navigation overwrote it -- an alias onto the same captured
 * pair above (kept as its own named accessor, mirroring the pre-wave-143
 * shape) so the D19 restore/kept logic reads self-documenting call sites.
 * `search` is only used the first time `key` is captured (see
 * captureNavigationContext); every later call for the same `key` returns
 * the already-frozen pair regardless of what `search` is passed. */
function getInitialStoredId(key: string, search: string): string | null {
  return captureNavigationContext(key, search).fromStorage;
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
  lastCapturedKey = null;
}

/** Test-only seam, mirroring resetEventsCacheForTests() above: a render
 * test suite reuses the module across `it()` blocks in the same file, but
 * each real navigation only ever captures a given key once while
 * instances for it are mounted. Never called from production code. */
export function resetInitialStoredIdForTests(): void {
  navigationContexts.clear();
  lastCapturedKey = null;
}

/** DEC-728 wave-25: navigation identity, as `{ pathname, search }`,
 * reactively when a react-router `<Router>` ancestor exists (so a
 * client-side navigation -- pushState via <Link>/navigate(), no full
 * document reload -- re-runs the resolve effect below with the new
 * location) and falling back to a plain, non-reactive
 * `window.location.pathname` + `window.location.search` read otherwise
 * (the render tests that call this hook, or render EventSwitchBanner, with
 * no MemoryRouter ancestor). `useInRouterContext()` is fixed for the
 * lifetime of a given component instance -- a tree either has a Router
 * ancestor or it doesn't, for as long as that instance stays mounted -- so
 * conditioning the useLocation() call on it does not violate React's
 * same-hooks-every-render invariant for that instance. */
function useLocationKey(): { pathname: string; search: string } {
  const inRouterContext = useInRouterContext();
  // eslint-disable-next-line react-hooks/rules-of-hooks -- see comment above.
  const location = inRouterContext ? useLocation() : null;
  return inRouterContext
    ? { pathname: location!.pathname, search: location!.search }
    : { pathname: window.location.pathname, search: window.location.search };
}

export function useCurrentEvent(): UseCurrentEventResult {
  // DEC-728 wave-25: navigation identity is `pathname + search`, not
  // `search` alone -- see the file-header amendment (defect 2). Two
  // different pages carrying the same query string are two different
  // navigations.
  const { pathname, search } = useLocationKey();
  const key = `${pathname}${search}`;
  const { fromUrl: initialFromUrl, fromStorage: initialFromStorage } = captureNavigationContext(key, search);
  const idInPlay = initialFromUrl ?? initialFromStorage ?? null;

  const [eventId, setEventId] = useState<string | null>(idInPlay);
  const [loading, setLoading] = useState(idInPlay === null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [switchInfo, setSwitchInfo] = useState<EventSwitchInfo | null>(null);

  useEffect(() => {
    // DEC-728 wave-143: this instance is now sharing the navigation keyed
    // by `key` -- hold a reference for as long as it's mounted for that
    // key, releasing (and possibly dropping the frozen snapshot) on
    // unmount or on a key change, so the NEXT navigation captures fresh
    // rather than replaying this one's pre-overwrite pair.
    acquireNavigationContext(key);
    let cancelled = false;

    // DEC-856: clear at the start of the read that can replace it, matching
    // the discipline applied to the other page-level error banners.
    //
    // DEC_728 wave-25 amendment (defect 1): `switchInfo` is cleared here
    // too, for the identical reason `error` is -- both are stale state from
    // whatever navigation this instance previously resolved. Without this,
    // a navigation to a URL with no `eventId` at all takes the
    // `!fromUrl && !fromStorage` branch below, which never calls
    // `setSwitchInfo`, so a banner announced by an earlier navigation
    // (EventSwitcher lives in the persistent shell, so this state survives
    // across every page the caller visits next) never gets cleared.
    setError(undefined);
    setSwitchInfo(null);
    const { fromUrl, fromStorage } = captureNavigationContext(key, search);
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
        releaseNavigationContext(key);
      };
    }

    // DEC-728 amendment (D19): a URL id that differs from what was already
    // stored is a silent cross-event switch -- capture the pre-overwrite
    // id *before* the write below replaces it, so it survives to name
    // resolution. Read from the navigation-scoped snapshot (wave-143
    // amendment above), not the per-instance `fromStorage` closed over at
    // render time: a sibling instance sharing this navigation may have
    // already overwritten storage by the time THIS instance's effect runs.
    const priorStored = getInitialStoredId(key, search);
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
      releaseNavigationContext(key);
    };
    // Re-runs whenever the navigation's key (pathname + search) changes --
    // a client-side react-router switch (RosterPanel's CSV-import link,
    // AddToEventModal's "View in Speakers" link) carries a new eventId
    // without a full page reload, and this instance must resolve it fresh
    // rather than replaying whatever navigation it first mounted with.
    // DEC_728 wave-25 (defect 2): keyed on `key`, not `search` alone -- two
    // different pages carrying the same query string are two different
    // navigations, so a pathname-only change must also re-run this effect.
  }, [key, search]);

  return { eventId, loading, error, switchInfo };
}
