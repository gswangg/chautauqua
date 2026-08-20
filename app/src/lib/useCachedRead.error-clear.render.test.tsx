// DEC_518: a path change must clear a live error banner alongside the cache
// seed, in the SAME `if (pathChanged)` branch inside useCachedRead.ts's
// effect (:61-84) -- otherwise a failed read's message rides onto the next
// key, and because `loading` is derived as
// `path !== null && data === undefined && error === null` (:101), the new
// key doesn't even show a skeleton: it shows the PREVIOUS key's failure
// banner as though it described the new object. This is the discipline
// useCurrentEvent.ts:103 already implements for the same shape (DEC-856).
//
// A bump-only run (mutationVersion changed, path did not) must NOT clear --
// DEC_700 (wave 121)'s comment right above the seed explains why a bump
// must leave the rendered payload alone, and the same reasoning covers a
// live failure banner about the CURRENT key: an unrelated mutation
// elsewhere in the app has no bearing on whether this key's own read
// failed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useCachedGet } from './useCachedRead';
import { apiPost, resetApiCacheForTests } from './api';
import { mockApi } from '../test-utils/mockApi';
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

describe('useCachedRead clears a live error on a path change (DEC_518)', () => {
  it('a failing key followed by a key change clears the error on the very first frame and shows loading, not the old banner', async () => {
    let resolveA2!: (value: Response) => void;
    const a2Promise = new Promise<Response>((resolve) => {
      resolveA2 = resolve;
    });
    const jsonResponse = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      if (path === '/api/v1/contacts/a1') {
        return new Response('boom', { status: 500 });
      }
      if (path === '/api/v1/contacts/a2') {
        return a2Promise;
      }
      throw new Error(`unhandled route ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => useCachedGet<Row>(path, 'Failed to load contact'),
      { initialProps: { path: '/contacts/a1' } },
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toBe('Request failed with status 500');

    // Switch to a second key whose read is still pending. The error from
    // the outgoing key must already be gone (and loading true, a skeleton)
    // on the very first frame after the change -- no waitFor needed, this
    // must be true synchronously off the rerender.
    rerender({ path: '/contacts/a2' });

    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Let the second read land cleanly, closing out the hook.
    await act(async () => {
      resolveA2(jsonResponse({ id: 'a2', name: 'Bea' }));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a2', name: 'Bea' });
    });
    expect(result.current.error).toBeNull();
  });

  it('a mutation-version bump on an UNCHANGED path does not clear a live error', async () => {
    let call = 0;
    mockApi({
      'GET /api/v1/contacts/a1': () => {
        call += 1;
        if (call === 1) return { id: 'a1', name: 'Ada' };
        return { status: 500, body: 'boom' };
      },
      'POST /api/v1/contacts': { ok: true },
    });

    const { result } = renderHook(() => useCachedGet<Row>('/contacts/a1', 'Failed to load contact'));
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 'a1', name: 'Ada' });
    });

    // Force a failing revalidation so a live error is on screen.
    await result.current.refetch();
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toBe('Request failed with status 500');

    // An unrelated mutation bumps mutationVersion without changing path.
    // The path-unchanged branch must leave the live error alone -- only a
    // real path change clears it.
    await act(async () => {
      await apiPost('/contacts');
    });

    expect(result.current.error).toBe('Request failed with status 500');
  });
});
