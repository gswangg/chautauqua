import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiList, apiPost } from './api';

describe('api client (DEC-013)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes /api/v1, sends credentials, and returns parsed JSON on success', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('/api/v1/events/ev1/submissions');
      expect(init?.credentials).toBe('include');
      return new Response(JSON.stringify({ items: [], total: 0, page: 1, perPage: 50 }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiList('/events/ev1/submissions');
    expect(result).toEqual({ items: [], total: 0, page: 1, perPage: 50 });
  });

  it('sets x-chq-csrf on mutations but not on GET', async () => {
    let seenHeaders: Headers | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenHeaders = new Headers(init?.headers);
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiPost('/events/ev1/submissions/status', { ids: ['a'], status: 'accepted' });
    expect(seenHeaders?.get('x-chq-csrf')).toBe('1');

    await apiGet('/events/ev1/submissions');
    expect(seenHeaders?.get('x-chq-csrf')).toBeNull();
  });

  it('throws typed ApiError from the error envelope', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 'invalid', message: 'bad status', fields: { status: 'unknown value' } } }), {
          status: 400,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet('/events/ev1/submissions')).rejects.toBeInstanceOf(ApiError);
    try {
      await apiGet('/events/ev1/submissions');
      throw new Error('expected apiGet to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe('invalid');
      expect(apiErr.fields).toEqual({ status: 'unknown value' });
    }
  });

  it('falls back to internal code when the body is not an error envelope', async () => {
    const fetchMock = vi.fn(async () => new Response('oops', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await apiGet('/events/ev1/submissions');
      throw new Error('expected apiGet to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('internal');
    }
  });
});
