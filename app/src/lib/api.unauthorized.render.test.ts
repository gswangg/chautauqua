// DEC-024 (wave-19 amendment): the 401 -> /login redirect is one policy
// owned by api.ts's request()/apiUpload()/apiPostBlob(), not a second reader
// duplicated in useMe.ts. Each wire path must still throw the typed
// ApiError so callers' catch/finally continue to run -- the redirect never
// silently resolves or hangs a caller. A 403 (signed in, no grant) must
// never redirect.
//
// Each `it` block resets the module registry and re-imports api.ts fresh so
// the module-private `redirecting` guard starts false per test -- otherwise
// the "assign exactly once" guard from an earlier test would leak into a
// later test in this same file and mask a real regression.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalLocation = window.location;

function stubLocationAssign(): ReturnType<typeof vi.fn> {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignSpy },
  });
  return assignSpy;
}

function unauthorizedResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: { code, message: 'nope' } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('api.ts 401 -> /login policy (DEC-024, wave-19 amendment)', () => {
  it('apiGet: a 401 rejects with ApiError(401) and assigns /login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => unauthorizedResponse(401, 'unauthorized')));
    const assignSpy = stubLocationAssign();
    const { apiGet, ApiError } = await import('./api');

    await expect(apiGet('/whatever')).rejects.toMatchObject({ status: 401 });
    await expect(apiGet('/whatever').catch((e) => e)).resolves.toBeInstanceOf(ApiError);
    expect(assignSpy).toHaveBeenCalledWith('/login');
  });

  it('two concurrent 401s assign /login exactly once', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => unauthorizedResponse(401, 'unauthorized')));
    const assignSpy = stubLocationAssign();
    const { apiGet } = await import('./api');

    const results = await Promise.allSettled([apiGet('/a'), apiGet('/b')]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/login');
  });

  it('a 403 rejects with ApiError(403) but never assigns /login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => unauthorizedResponse(403, 'forbidden')));
    const assignSpy = stubLocationAssign();
    const { apiGet } = await import('./api');

    await expect(apiGet('/whatever')).rejects.toMatchObject({ status: 403 });
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('apiUpload: a 401 rejects with ApiError(401) and assigns /login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => unauthorizedResponse(401, 'unauthorized')));
    const assignSpy = stubLocationAssign();
    const { apiUpload } = await import('./api');

    await expect(apiUpload('/files', new FormData())).rejects.toMatchObject({ status: 401 });
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/login');
  });

  it('apiUpload: a 403 never assigns /login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => unauthorizedResponse(403, 'forbidden')));
    const assignSpy = stubLocationAssign();
    const { apiUpload } = await import('./api');

    await expect(apiUpload('/files', new FormData())).rejects.toMatchObject({ status: 403 });
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('apiPostBlob: a 401 rejects with ApiError(401) and assigns /login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => unauthorizedResponse(401, 'unauthorized')));
    const assignSpy = stubLocationAssign();
    const { apiPostBlob } = await import('./api');

    await expect(apiPostBlob('/export', {})).rejects.toMatchObject({ status: 401 });
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/login');
  });

  it('apiPostBlob: a 403 never assigns /login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => unauthorizedResponse(403, 'forbidden')));
    const assignSpy = stubLocationAssign();
    const { apiPostBlob } = await import('./api');

    await expect(apiPostBlob('/export', {})).rejects.toMatchObject({ status: 403 });
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
