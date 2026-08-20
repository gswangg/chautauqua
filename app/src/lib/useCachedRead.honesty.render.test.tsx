// DEC_518 D21: the behavioural half of useCachedRead.ts's SWR contract, one
// level up from the unit-shaped assertions in useCachedRead.render.test.tsx
// (v12m-w4-t-r1-a). Three honesty properties, each a lie DEC_518 forbids:
//
//   1. mount -> resolve -> unmount -> remount paints the cached payload with
//      loading===false on the very first render (no flash back to loading);
//      a background revalidation that then REJECTS must leave the rendered
//      data in place AND set a non-null error -- a stale payload with a
//      null error is indistinguishable from a fresh, successful read, which
//      is exactly the lie this pins against.
//   2. a background revalidation that RESOLVES with a payload missing one
//      of the previously-cached items makes that item disappear -- a
//      wholesale replace, never a merge/union with what was already there.
//   3. a successful mutation (apiPost) drops the cache entry
//      (peekCachedRead returns undefined afterwards) while a MOUNTED hook
//      holding that data does not blank or flash to a loading state -- it
//      keeps rendering its rows and refetches silently over them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useCachedGet, useCachedList } from './useCachedRead';
import { apiPost, peekCachedRead, resetApiCacheForTests } from './api';
import { mockApi, listEnvelope } from '../test-utils/mockApi';
import { DEC_518 } from '../../../src/decisions';
void DEC_518;

interface Row {
  id: string;
  name: string;
}

beforeEach(() => {
  resetApiCacheForTests();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetApiCacheForTests();
});

describe('useCachedRead honesty (DEC_518)', () => {
  it('mount, resolve, unmount, remount paints cached data with loading===false, then a rejected revalidation keeps stale data and sets a non-null error', async () => {
    let call = 0;
    mockApi({
      'GET /api/v1/contacts/a1': () => {
        call += 1;
        if (call === 1) return { id: 'a1', name: 'Ada' };
        return { status: 500, body: 'boom' };
      },
    });

    const first = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));
    await waitFor(() => {
      expect(first.result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });
    expect(first.result.current.loading).toBe(false);
    expect(first.result.current.error).toBeNull();
    first.unmount();

    // Remount at the same path: the cached payload from the first mount
    // must paint on the very first frame -- loading===false immediately,
    // no flash back to a loading state.
    const second = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    expect(second.result.current.error).toBeNull();

    // The remount's own effect issues a background revalidation, which the
    // mock resolves as a 500 on this second call. It must reject without
    // ever blanking the already-rendered data.
    await waitFor(() => {
      expect(second.result.current.error).not.toBeNull();
    });
    expect(second.result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    expect(second.result.current.error).toBe('Request failed with status 500');
  });

  it('a resolved revalidation missing a previously-cached item drops that item (wholesale replace, never a merge)', async () => {
    let call = 0;
    mockApi({
      'GET /api/v1/contacts': () => {
        call += 1;
        if (call === 1) {
          return listEnvelope<Row>([
            { id: 'a1', name: 'Ada' },
            { id: 'a2', name: 'Bea' },
            { id: 'a3', name: 'Cid' },
          ]);
        }
        return listEnvelope<Row>([{ id: 'a2', name: 'Bea' }]);
      },
    });

    const { result } = renderHook(() => useCachedList<Row>('/contacts', 'Failed to load contacts'));
    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(3);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.items).toEqual([{ id: 'a2', name: 'Bea' }]);
    });
    // a1 and a3 are gone entirely -- not retained, not merged in alongside
    // the fresh a2.
    expect(result.current.data?.items.map((row) => row.id)).toEqual(['a2']);
    expect(result.current.error).toBeNull();
  });

  it('a successful mutation drops the cache entry while a mounted hook holding that data refetches over its rows without ever rendering a blank/loading frame (DEC_700 amendment, wave 121)', async () => {
    // A hand-rolled fetch stub, not mockApi: the post-mutation background
    // GET must resolve on a LATER turn of the event loop than the code that
    // triggers it, never inside the caller's own microtask batch. If it
    // resolved synchronously, React would coalesce the effect's re-seed (if
    // any survived) and the refetch's landing setData into one render, and
    // the very frame this test exists to forbid would never be observable.
    let getCall = 0;
    let resolveDeferredGet: (() => void) | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      const method = (init?.method ?? 'GET').toUpperCase();
      const jsonResponse = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

      if (method === 'GET' && path === '/api/v1/contacts/a1') {
        getCall += 1;
        if (getCall === 1) return jsonResponse({ id: 'a1', name: 'Ada' });
        // Second GET (the post-mutation background refetch) -- park it
        // until the test explicitly releases it below.
        await new Promise<void>((resolve) => {
          resolveDeferredGet = resolve;
        });
        return jsonResponse({ id: 'a1', name: 'Ada Updated' });
      }
      // A REAL registered mutation route (POST /api/v1/contacts), not a
      // synthetic one: test/spa-mock-route-contract.scan.test.ts resolves
      // every mockApi key in the suite against the live route table, and a
      // made-up path would read there as the SPA believing in an unbuilt
      // endpoint. The point of this route is only that the mutation lands
      // on a DIFFERENT path than the cached read above, which /contacts is.
      if (method === 'POST' && path === '/api/v1/contacts') return jsonResponse({ ok: true });
      throw new Error(`mock: no route registered for "${method} ${path}"`);
    });
    vi.stubGlobal('fetch', fetchMock);

    // Records data/loading from inside the hook's own render, so a frame
    // that React coalesces away from `result.current` can't hide from this
    // test the way it hid from the old synchronous-assertion version.
    const frames: string[] = [];
    const { result } = renderHook(() => {
      const r = useCachedGet<Row>('/contacts/a1', 'Failed to load contact');
      frames.push(`data=${r.data === undefined ? 'undefined' : r.data.name} loading=${r.loading}`);
      return r;
    });
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });
    expect(peekCachedRead<Row>('/contacts/a1')).toEqual({ id: 'a1', name: 'Ada' });

    // Only frames from the mutation onward are under test.
    frames.length = 0;

    // A successful mutation bumps the shared mutation version (DEC-700),
    // which api.ts's subscription uses to clear the whole read cache.
    await apiPost('/contacts');

    // The cache entry is gone immediately...
    expect(peekCachedRead<Row>('/contacts/a1')).toBeUndefined();
    // ...but the still-mounted hook never blanks its rows or flips back to
    // loading -- useCachedReadInternal's mutation-version effect issues a
    // background re-read without first re-seeding `data` from the (now
    // empty) cache.
    expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    expect(result.current.loading).toBe(false);

    // Release the deferred GET and flush across the real turn of the event
    // loop it resolves on.
    expect(resolveDeferredGet).not.toBeNull();
    await act(async () => {
      resolveDeferredGet!();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada Updated' });
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    // No frame recorded from the mutation onward carries a blank payload or
    // a flip back to loading -- the property the old synchronous assertion
    // could not actually observe.
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame).not.toContain('loading=true');
      expect(frame).not.toContain('data=undefined');
    }
  });
});
