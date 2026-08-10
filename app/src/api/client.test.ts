import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes /api/v1, sends credentials, and returns parsed JSON on success', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('/api/v1/overview');
      expect(init?.credentials).toBe('include');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ ok: boolean }>('/overview');
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sets x-chq-csrf header on non-GET requests but not on GET', async () => {
    let seenHeaders: Headers | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenHeaders = new Headers(init?.headers);
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/thing', { method: 'POST', body: JSON.stringify({}) });
    expect(seenHeaders?.get('x-chq-csrf')).toBe('1');

    await apiFetch('/thing');
    expect(seenHeaders?.get('x-chq-csrf')).toBeNull();
  });

  it('throws ApiError with status and body when the response is not ok', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'nope' }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/forbidden')).rejects.toMatchObject({
      status: 403,
      body: { message: 'nope' },
    });
    await expect(apiFetch('/forbidden')).rejects.toBeInstanceOf(ApiError);
  });
});
