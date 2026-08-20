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
import { cleanup, renderHook, waitFor } from '@testing-library/react';
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

  it('a successful mutation drops the cache entry while a mounted hook holding that data refetches over its rows without blanking', async () => {
    let getCall = 0;
    mockApi({
      'GET /api/v1/contacts/a1': () => {
        getCall += 1;
        // Second GET (the post-mutation refetch) returns an updated name --
        // proves the mount actually refetched, not just re-read stale state.
        if (getCall === 1) return { id: 'a1', name: 'Ada' };
        return { id: 'a1', name: 'Ada Updated' };
      },
      'POST /api/v1/contacts/a1/touch': { ok: true },
    });

    const { result } = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });
    expect(peekCachedRead<Row>('/contacts/a1')).toEqual({ id: 'a1', name: 'Ada' });

    // A successful mutation bumps the shared mutation version (DEC-700),
    // which api.ts's subscription uses to clear the whole read cache.
    await apiPost('/contacts/a1/touch');

    // The cache entry is gone immediately...
    expect(peekCachedRead<Row>('/contacts/a1')).toBeUndefined();
    // ...but the still-mounted hook never blanks its rows or flips back to
    // loading -- useCachedReadInternal's mutation-version effect calls
    // read() again without first clearing `data`.
    expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    expect(result.current.loading).toBe(false);

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada Updated' });
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
