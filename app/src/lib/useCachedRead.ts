// DEC_013 / DEC_851: React binding for the SWR read cache. A page adopts
// this instead of a raw useEffect + apiGet/apiList pair to get a cached
// payload on screen on the first frame and automatic re-reads whenever
// mutationSignal's version bumps (DEC_700).
import { useCallback, useEffect, useState } from 'react';
import { apiGetCached, apiListCached, ApiError, peekCachedRead, type ListEnvelope } from './api';
import { useMutationVersion } from './mutationSignal';
import { DEC_518, DEC_678 } from '../../../src/decisions';
void DEC_518;
void DEC_678;

export interface CachedRead<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useCachedReadInternal<T>(
  path: string | null,
  failureMessage: string,
  read: (path: string) => Promise<T>,
): CachedRead<T> {
  const mutationVersion = useMutationVersion();
  const [data, setData] = useState<T | undefined>(() => (path === null ? undefined : peekCachedRead<T>(path)));
  const [error, setError] = useState<string | null>(null);

  const runRead = useCallback(
    async (p: string) => {
      try {
        // DEC_518: on resolve REPLACE the payload wholesale and clear the
        // error — never merge with what was already on screen.
        const fresh = await read(p);
        setData(fresh);
        setError(null);
      } catch (err) {
        // DEC_518: on reject, leave data untouched (stale rows stay on
        // screen) and surface the failure via error.
        setError(err instanceof ApiError ? err.message : failureMessage);
      }
    },
    [read, failureMessage],
  );

  useEffect(() => {
    if (path === null) {
      setData(undefined);
      setError(null);
      return;
    }
    // Seed synchronously from the cache before issuing the re-read, so a
    // path change that already has a cached payload paints immediately.
    setData(peekCachedRead<T>(path));
    let cancelled = false;
    (async () => {
      try {
        const fresh = await read(path);
        if (cancelled) return;
        setData(fresh);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : failureMessage);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, mutationVersion]);

  const refetch = useCallback(async () => {
    if (path === null) return;
    await runRead(path);
  }, [path, runRead]);

  // DEC_678: loading means "nothing to render", never "a request is in
  // flight" — derived, not stored, so a cached payload never shows a
  // skeleton.
  const loading = path !== null && data === undefined && error === null;

  return { data, loading, error, refetch };
}

export function useCachedGet<T>(path: string | null, failureMessage: string): CachedRead<T> {
  return useCachedReadInternal<T>(path, failureMessage, (p) => apiGetCached<T>(p));
}

export function useCachedList<T>(path: string | null, failureMessage: string): CachedRead<ListEnvelope<T>> {
  return useCachedReadInternal<ListEnvelope<T>>(path, failureMessage, (p) => apiListCached<T>(p));
}
