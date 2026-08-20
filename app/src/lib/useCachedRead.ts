// DEC_013 / DEC_851: React binding for the SWR read cache. A page adopts
// this instead of a raw useEffect + apiGet/apiList pair to get a cached
// payload on screen on the first frame and automatic re-reads whenever
// mutationSignal's version bumps (DEC_700).
import { useCallback, useEffect, useRef, useState } from 'react';
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

  // DEC_518: a resolve only lands if it is still the current (path,
  // generation) pair — the single cancellation rule for both the path-driven
  // effect below and an explicit re-fetch call that outlives a path change.
  const pathRef = useRef<string | null>(path);
  const generationRef = useRef(0);

  // DEC_700 amendment (wave 121): tracks the path the last effect run saw, so
  // a mutationVersion-only bump (same path) can be told apart from a real
  // path change. Only a real path change re-seeds from the cache; a bump-only
  // run goes straight to runRead and leaves the on-screen data alone until
  // the fresh payload lands, so a cached read never blanks mid-mutation.
  const prevEffectPathRef = useRef<string | null>(path);

  const runRead = useCallback(
    async (p: string, generation: number) => {
      try {
        // DEC_518: on resolve REPLACE the payload wholesale and clear the
        // error — never merge with what was already on screen — but only
        // if nothing has moved the key on since this read was issued.
        const fresh = await read(p);
        if (generation !== generationRef.current || p !== pathRef.current) return;
        setData(fresh);
        setError(null);
      } catch (err) {
        if (generation !== generationRef.current || p !== pathRef.current) return;
        // DEC_518: on reject, leave data untouched (stale rows stay on
        // screen) and surface the failure via error.
        setError(err instanceof ApiError ? err.message : failureMessage);
      }
    },
    [read, failureMessage],
  );

  useEffect(() => {
    pathRef.current = path;
    generationRef.current += 1;
    const generation = generationRef.current;
    if (path === null) {
      prevEffectPathRef.current = null;
      setData(undefined);
      setError(null);
      return;
    }
    // Seed synchronously from the cache before issuing the re-read, so a
    // path change that already has a cached payload paints immediately.
    // DEC_700 amendment (wave 121): only do this seed on an actual path
    // change. A bump-only run (mutationVersion changed, path did not) must
    // NOT re-seed from the cache — api.ts's clearReadCache mutation
    // subscriber runs before this effect on every successful write, so the
    // cache is already empty here and re-seeding would blank a still-valid
    // on-screen payload and flip loading back to true for the round trip.
    const pathChanged = prevEffectPathRef.current !== path;
    prevEffectPathRef.current = path;
    if (pathChanged) {
      setData(peekCachedRead<T>(path));
    }
    void runRead(path, generation);
    return () => {
      // Bump on unmount and on every dep change so an in-flight resolve for
      // the outgoing (path, generation) pair is discarded by runRead's guard.
      generationRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, mutationVersion]);

  const refetch = useCallback(async () => {
    if (path === null) return;
    await runRead(path, generationRef.current);
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
