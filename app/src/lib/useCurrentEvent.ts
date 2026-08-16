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
import { useEffect, useState } from 'react';
import { apiList, ApiError } from './api';
import { reconcileStoredEventId } from '../components/eventSwitcherState';

const STORAGE_KEY = 'chq.currentEventId';

export interface UseCurrentEventResult {
  eventId: string | null;
  loading: boolean;
  error?: string;
}

export interface EventListItem {
  id: string;
  name: string;
}

let eventsPromise: Promise<EventListItem[]> | null = null;

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
}

export function useCurrentEvent(): UseCurrentEventResult {
  const fromUrl = new URLSearchParams(window.location.search).get('eventId');
  const fromStorage = window.localStorage.getItem(STORAGE_KEY);
  const idInPlay = fromUrl ?? fromStorage ?? null;

  const [eventId, setEventId] = useState<string | null>(idInPlay);
  const [loading, setLoading] = useState(idInPlay === null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    // DEC-856: clear at the start of the read that can replace it, matching
    // the discipline applied to the other page-level error banners.
    setError(undefined);
    if (!fromUrl && !fromStorage) {
      setLoading(true);
      loadEventsOnce()
        .then((items) => {
          const first = items[0];
          if (!first) {
            setError('No events exist yet.');
            return;
          }
          window.localStorage.setItem(STORAGE_KEY, first.id);
          setEventId(first.id);
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : 'Failed to resolve current event');
        })
        .finally(() => setLoading(false));
      return;
    }

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
    // fetch problem.
    const idToReconcile = (fromUrl ?? fromStorage) as string;
    let cancelled = false;
    loadEventsOnce()
      .then((items) => {
        if (cancelled || items.length === 0) return;
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
    };
    // Deliberately runs once: URL/localStorage are read synchronously above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { eventId, loading, error };
}
