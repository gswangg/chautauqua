// DEC_700 (wave-144 amendment): a cached read carries the invalidation
// epoch it started under. This interleaves a cached read with a mutation
// that lands WHILE the read is still in flight, proving the read's late
// resolution can no longer repopulate the cache after the clear it should
// have honoured.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetCached, apiListCached, apiPost, peekCachedRead, resetApiCacheForTests } from './api';

// A deferred promise, so the test controls exactly when the mocked fetch's
// GET resolves relative to the interleaved mutation firing.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('SWR read cache epoch race (DEC_700)', () => {
  beforeEach(() => {
    resetApiCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('apiGetCached: a mutation landing mid-flight prevents the late read from repopulating the cache', async () => {
    const getGate = deferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/contacts/a1') && !String(input).includes('note')) {
        return getGate.promise;
      }
      // The interleaved mutation resolves immediately.
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    // Start the cached read but do not await it yet -- it is now in flight.
    const readPromise = apiGetCached('/contacts/a1');

    // A mutation lands and clears the cache WHILE the read above is still
    // pending.
    await apiPost('/contacts/a1/notes', { text: 'hi' });
    expect(peekCachedRead('/contacts/a1')).toBeUndefined();

    // Now let the stale GET resolve, carrying pre-mutation data.
    getGate.resolve(new Response(JSON.stringify({ id: 'a1', name: 'stale' }), { status: 200 }));
    const result = await readPromise;

    // The cache must still be empty -- the late write must have been
    // skipped, not allowed to resurrect stale data after the clear.
    expect(peekCachedRead('/contacts/a1')).toBeUndefined();
    // But the in-flight request's own caller is not swallowed or invented --
    // it still receives its actual (now-stale, but honestly-stale) result.
    expect(result).toEqual({ id: 'a1', name: 'stale' });
  });

  it('apiListCached: a mutation landing mid-flight prevents the late read from repopulating the cache', async () => {
    const listGate = deferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/contacts') && !String(input).includes('note')) {
        return listGate.promise;
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const readPromise = apiListCached('/contacts');

    await apiPost('/contacts/a1/notes', { text: 'hi' });
    expect(peekCachedRead('/contacts')).toBeUndefined();

    listGate.resolve(new Response(JSON.stringify({ items: [{ id: 'a1' }], total: 1, page: 1, perPage: 50 }), { status: 200 }));
    const result = await readPromise;

    expect(peekCachedRead('/contacts')).toBeUndefined();
    expect(result).toEqual({ items: [{ id: 'a1' }], total: 1, page: 1, perPage: 50 });
  });

  it('control: a read with no interleaved mutation still populates the cache (the fix does not just disable caching)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'a1', name: 'fresh' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiGetCached('/contacts/a1');

    expect(result).toEqual({ id: 'a1', name: 'fresh' });
    expect(peekCachedRead('/contacts/a1')).toEqual({ id: 'a1', name: 'fresh' });
  });

  it('control: the in-flight read still resolves with its own data even when its cache write is dropped', async () => {
    const getGate = deferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/contacts/a1') && !String(input).includes('note')) {
        return getGate.promise;
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const readPromise = apiGetCached('/contacts/a1');
    await apiPost('/contacts/a1/notes', { text: 'hi' });
    getGate.resolve(new Response(JSON.stringify({ id: 'a1', name: 'stale' }), { status: 200 }));

    // The promise the original caller is holding must not reject, hang, or
    // resolve to an invented/empty value -- it is the request's own answer.
    await expect(readPromise).resolves.toEqual({ id: 'a1', name: 'stale' });
  });
});
