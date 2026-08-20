// DEC_013 / DEC_518 / DEC_678 / DEC_851: the React binding over the SWR
// read cache. A cached payload paints on the first frame; a rejected
// revalidation keeps stale data and raises error; a resolved one replaces
// the payload wholesale.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useCachedGet, useCachedList } from './useCachedRead';
import { resetApiCacheForTests } from './api';
import { mockApi, listEnvelope } from '../test-utils/mockApi';

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

describe('useCachedGet / useCachedList', () => {
  it('cold read renders loading true then data', async () => {
    mockApi({ 'GET /api/v1/contacts/a1': { id: 'a1', name: 'Ada' } });

    const { result } = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('a second mount at the same path has loading===false and data on the first frame', async () => {
    mockApi({ 'GET /api/v1/contacts/a1': { id: 'a1', name: 'Ada' } });

    const first = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));
    await waitFor(() => {
      expect(first.result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });

    const second = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.data).toEqual({ id: 'a1', name: 'Ada' });
  });

  it('a rejected revalidation keeps stale data and sets error', async () => {
    let call = 0;
    mockApi({
      'GET /api/v1/contacts/a1': () => {
        call += 1;
        if (call === 1) return { id: 'a1', name: 'Ada' };
        return { status: 500, body: 'boom' };
      },
    });

    const { result } = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });

    await result.current.refetch();

    await waitFor(() => {
      // The rejection is an ApiError (a 500 with a non-envelope body), so
      // the surfaced message is the ApiError's own, not the failureMessage
      // fallback -- see useCachedRead.ts's `err instanceof ApiError` branch.
      expect(result.current.error).toBe('Request failed with status 500');
    });
    // Stale rows stay on screen -- DEC_518 never clears data on a failed
    // revalidation.
    expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
  });

  it('a resolved revalidation REPLACES the payload wholesale (a row absent from the fresh list is gone)', async () => {
    let call = 0;
    mockApi({
      'GET /api/v1/contacts': () => {
        call += 1;
        if (call === 1) {
          return listEnvelope<Row>([
            { id: 'a1', name: 'Ada' },
            { id: 'a2', name: 'Bea' },
          ]);
        }
        return listEnvelope<Row>([{ id: 'a2', name: 'Bea' }]);
      },
    });

    const { result } = renderHook(() => useCachedList<Row>('/contacts', 'Failed to load contacts'));
    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(2);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.items).toEqual([{ id: 'a2', name: 'Bea' }]);
    });
    expect(result.current.data?.items.find((row) => row.id === 'a1')).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('DEC_518 wave-117: a refetch() whose key changes before it resolves never lands its stale payload or an error', async () => {
    // mockApi's route handler result is never awaited (it JSON.stringifies
    // it synchronously), so a genuinely held-open response needs a hand-
    // rolled fetch stub rather than mockApi's function-handler form.
    let resolveRefetch!: (value: Response) => void;
    const refetchResponsePromise = new Promise<Response>((resolve) => {
      resolveRefetch = resolve;
    });
    let contactsA1Calls = 0;
    const jsonResponse = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      if (path === '/api/v1/contacts/a1') {
        contactsA1Calls += 1;
        if (contactsA1Calls === 1) return jsonResponse({ id: 'a1', name: 'Ada' });
        return refetchResponsePromise;
      }
      if (path === '/api/v1/contacts/a2') return jsonResponse({ id: 'a2', name: 'Bea' });
      throw new Error(`unhandled route ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ path }: { path: string }) => useCachedGet<Row>(path, 'Failed to load contact'), {
      initialProps: { path: '/contacts/a1' },
    });
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });

    // Issue the refetch (held open), then change the key before it resolves.
    const refetching = result.current.refetch();
    rerender({ path: '/contacts/a2' });
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a2', name: 'Bea' });
    });

    resolveRefetch(jsonResponse({ id: 'a1', name: 'STALE' }));
    await refetching;
    // A real macrotask flush, not just a couple of microtask ticks -- the
    // stale runRead's setData/setError call (if unguarded) lands a tick
    // later than refetching's own promise settles, via Response.json()'s
    // own microtask chain, so a bare `await Promise.resolve()` twice is not
    // enough to observe it landing.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // The stale a1 refetch must never overwrite the a2 view, and must never
    // raise an error on a view it no longer belongs to.
    expect(result.current.data).toEqual({ id: 'a2', name: 'Bea' });
    expect(result.current.error).toBeNull();
  });

  it('DEC_518 wave-117: a refetch() that resolves while the key is unchanged still replaces the payload and clears the error (the guard is not over-tight)', async () => {
    let call = 0;
    mockApi({
      'GET /api/v1/contacts/a1': () => {
        call += 1;
        if (call === 1) return { id: 'a1', name: 'Ada' };
        return { id: 'a1', name: 'Ada Updated' };
      },
    });

    const { result } = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada Updated' });
    });
    expect(result.current.error).toBeNull();
  });

  it('DEC-856: a failed read followed by a real path change clears the stale error and renders a skeleton, not the previous key\'s banner', async () => {
    // A1 fails; a2's response is held open so the assertion below observes
    // the state strictly BETWEEN the path change and a2's read settling.
    let resolveA2!: (value: Response) => void;
    const a2ResponsePromise = new Promise<Response>((resolve) => {
      resolveA2 = resolve;
    });
    const jsonResponse = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      if (path === '/api/v1/contacts/a1') return new Response('boom', { status: 500 });
      if (path === '/api/v1/contacts/a2') return a2ResponsePromise;
      throw new Error(`unhandled route ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ path }: { path: string }) => useCachedGet<Row>(path, 'Failed to load contact'), {
      initialProps: { path: '/contacts/a1' },
    });
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.data).toBeUndefined();

    // Real path change: a1's error must not survive onto a2's view. Await
    // the effect flush (React's own microtask/act settling), not a
    // synchronous read of result.current -- the state only updates once the
    // effect has actually run.
    rerender({ path: '/contacts/a2' });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    // Still nothing to render for a2 (its read is held open) -- this must
    // read as loading (a skeleton), never as the stale a1 banner.
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(true);

    resolveA2(jsonResponse({ id: 'a2', name: 'Bea' }));
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a2', name: 'Bea' });
    });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('path === null is fully inert -- no request, immediately settled empty', () => {
    const fetchMock = mockApi({});

    const { result } = renderHook(() => useCachedGet<Row>(null, 'Failed to load contact'));

    expect(result.current).toEqual({
      data: undefined,
      loading: false,
      error: null,
      refetch: expect.any(Function),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
