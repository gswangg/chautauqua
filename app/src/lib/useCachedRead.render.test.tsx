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
