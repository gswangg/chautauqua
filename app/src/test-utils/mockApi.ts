// DEC-144 layer-2 harness: fetch-stubbing helper for component-render smoke
// tests. Pages talk to the API exclusively through app/src/lib/api.ts,
// which calls the global `fetch`. This helper stubs `globalThis.fetch` and
// resolves requests by `"METHOD /api/v1/path"` (query strings are stripped
// before matching, so callers register routes without worrying about exact
// filter/sort querystrings). Response bodies must be shaped like the real
// wire envelopes so a render test failing to unwrap `items`/`fields`
// correctly fails the same way the browser would.

import { vi } from 'vitest';

export interface MockResponseSpec {
  status?: number;
  body: unknown;
}

export type MockRouteHandler = unknown | (() => unknown) | MockResponseSpec;

function isMockResponseSpec(value: unknown): value is MockResponseSpec {
  return typeof value === 'object' && value !== null && 'body' in value;
}

/** Registers `fetch` route handlers keyed by "METHOD /api/v1/path" (no
 * query string) and stubs `globalThis.fetch` to serve them. Returns the
 * underlying vi.fn() mock for assertions. Throws loudly if a request hits
 * an unregistered route — no silent fallback to a real network call. */
export function mockApi(routes: Record<string, MockRouteHandler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input.toString();
    const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = `${method} ${path}`;

    if (!(key in routes)) {
      throw new Error(`mockApi: no route registered for "${key}"`);
    }

    const handler = routes[key];
    const resolved = typeof handler === 'function' ? handler() : handler;
    const spec: MockResponseSpec = isMockResponseSpec(resolved)
      ? (resolved as MockResponseSpec)
      : { status: 200, body: resolved };

    return new Response(JSON.stringify(spec.body), {
      status: spec.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Builds a real list envelope: {items, total, page, perPage}. Callers that
 * need the files-library envelope's extra `totalSizeBytes`/`kindCounts`
 * (DEC-773/DEC-902) pass them as overrides; every other list endpoint
 * ignores the extra fields. */
export function listEnvelope<T>(
  items: T[],
  overrides: Partial<{
    total: number;
    totalSizeBytes: number;
    page: number;
    perPage: number;
    kindCounts: Record<string, number>;
    // DEC-913: the submissions worklist envelope's grouped chip/headline
    // counts. Default to an all-zero shape (not undefined) so tests that
    // don't care about the chip numbers still get a defined, non-null
    // envelope shape — matching what the real server always returns.
    contentStatusCounts: { pending: number; approved: number; changes_requested: number };
    reuploadedCount: number;
    // DEC-745 (wave-72 amendment): GET /plans/:id/progress's submissionsInScope
    // -- the plan editor's persistent cap row reads its summary off this.
    // Undefined by default (omitted from the response), matching every other
    // apiList<T> caller that doesn't care about it.
    submissionsInScope: number;
    // DEC-027 wave-51 amendment: GET /tokens' bound on the org's
    // bearer-token population. Undefined by default (omitted from the
    // response), matching every other apiList<T> caller that doesn't care
    // about it.
    max: number;
  }> = {},
): {
  items: T[];
  total: number;
  totalSizeBytes: number;
  page: number;
  perPage: number;
  kindCounts: Record<string, number>;
  contentStatusCounts: { pending: number; approved: number; changes_requested: number };
  reuploadedCount: number;
  submissionsInScope?: number;
  max?: number;
} {
  return {
    items,
    total: overrides.total ?? items.length,
    totalSizeBytes: overrides.totalSizeBytes ?? 0,
    page: overrides.page ?? 1,
    perPage: overrides.perPage ?? 20,
    kindCounts: overrides.kindCounts ?? {},
    contentStatusCounts: overrides.contentStatusCounts ?? { pending: 0, approved: 0, changes_requested: 0 },
    reuploadedCount: overrides.reuploadedCount ?? 0,
    ...(overrides.submissionsInScope !== undefined ? { submissionsInScope: overrides.submissionsInScope } : {}),
    ...(overrides.max !== undefined ? { max: overrides.max } : {}),
  };
}

/** Builds the real error envelope: {error: {code, message, fields?}}. */
export function errorEnvelope(
  code: string,
  message: string,
  fields?: Record<string, string>,
): { error: { code: string; message: string; fields?: Record<string, string> } } {
  return { error: { code, message, fields } };
}
