// DEC_013 / DEC_700 / DEC_851: the SWR read cache in api.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetCached, apiListCached, apiPost, peekCachedRead, resetApiCacheForTests } from './api';

describe('SWR read cache (DEC_013)', () => {
  beforeEach(() => {
    resetApiCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caches a hit on an identical URL and misses on a differing one', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify({ id: 'a1', name: 'Ada' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(peekCachedRead('/contacts/a1')).toBeUndefined();
    await apiGetCached('/contacts/a1');
    expect(calls).toBe(1);
    expect(peekCachedRead('/contacts/a1')).toEqual({ id: 'a1', name: 'Ada' });

    // A differing path is a distinct cache key -- no hit.
    expect(peekCachedRead('/contacts/a2')).toBeUndefined();
  });

  it('only caches a 2xx payload -- a 4xx leaves the entry absent', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 'not_found', message: 'nope' } }), { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGetCached('/contacts/missing')).rejects.toThrow();
    expect(peekCachedRead('/contacts/missing')).toBeUndefined();
  });

  it('peekCachedRead is synchronous and issues no request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiListCached('/contacts');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const result = peekCachedRead('/contacts');
    expect(result).toEqual({ items: [], total: 0 });
    // No additional call was made by the peek itself.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a successful apiPost anywhere clears the whole read cache', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/contacts/a1')) {
        return new Response(JSON.stringify({ id: 'a1' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiGetCached('/contacts/a1');
    expect(peekCachedRead('/contacts/a1')).toEqual({ id: 'a1' });

    await apiPost('/contacts/a1/notes', { text: 'hi' });

    expect(peekCachedRead('/contacts/a1')).toBeUndefined();
  });

  it('bounds the cache at 32 entries with least-recently-read eviction', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    for (let i = 0; i < 32; i++) {
      await apiGetCached(`/contacts/c${i}`);
    }
    // Touch c0 so it is the most-recently-read entry, not the oldest.
    peekCachedRead('/contacts/c0');

    // Insert a 33rd distinct entry -- something must be evicted.
    await apiGetCached('/contacts/c32');

    // c0 was refreshed by the peek above, so it must survive the eviction;
    // c1, the next-oldest untouched entry, must be the one evicted.
    expect(peekCachedRead('/contacts/c0')).toEqual({ ok: true });
    expect(peekCachedRead('/contacts/c1')).toBeUndefined();
    expect(peekCachedRead('/contacts/c32')).toEqual({ ok: true });
  });

  it('resetApiCacheForTests empties the cache', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiGetCached('/contacts/a1');
    expect(peekCachedRead('/contacts/a1')).toEqual({ ok: true });

    resetApiCacheForTests();

    expect(peekCachedRead('/contacts/a1')).toBeUndefined();
  });
});
