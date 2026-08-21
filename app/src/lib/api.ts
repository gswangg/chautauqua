// DEC-013: SPA -> API client. Fetch wrapper: credentials 'include', sets
// x-chq-csrf on mutations, unwraps the list envelope, throws a typed
// ApiError on any error envelope. This is the ONLY module the SPA uses to
// talk to /api/v1 — page code must never call fetch() directly.

import { bumpMutationVersion, subscribeToMutationVersion } from './mutationSignal';
import { DEC_013, DEC_700, DEC_678, DEC_851, DEC_154 } from '../../../src/decisions';
void DEC_013;
void DEC_700;
void DEC_678;
void DEC_851;
void DEC_154;

const API_PREFIX = '/api/v1';

// DEC_013: SWR read cache, opt-in per call site via apiGetCached/apiListCached.
// Keyed on the exact request URL (the identical string handed to fetch), so
// two different paths never collide and the same path always hits.
// DEC_851: this cache must never land without a page reading it — see
// ContactsApp.tsx's directory list, its first page reader.
const readCache = new Map<string, unknown>();
const READ_CACHE_LIMIT = 32;

function cacheKey(path: string): string {
  return `${API_PREFIX}${path}`;
}

function cacheSet(key: string, value: unknown): void {
  // Least-recently-read eviction: delete-then-set moves an existing key to
  // the end of Map's insertion order, and a full cache evicts the oldest
  // (first) entry before inserting.
  readCache.delete(key);
  if (readCache.size >= READ_CACHE_LIMIT) {
    const oldest = readCache.keys().next().value;
    if (oldest !== undefined) readCache.delete(oldest);
  }
  readCache.set(key, value);
}

/** Synchronous cache peek — no request, no React import, safe to call from
 * a useState initializer (DEC_678: a cached payload is on screen on the
 * first frame). Re-inserts on read to refresh recency for the LRU bound. */
export function peekCachedRead<T>(path: string): T | undefined {
  const key = cacheKey(path);
  if (!readCache.has(key)) return undefined;
  const value = readCache.get(key) as T;
  readCache.delete(key);
  readCache.set(key, value);
  return value;
}

// DEC_700 (wave-144 amendment): a cached read carries the invalidation
// epoch it started under. clearReadCache() empties the cache synchronously,
// but a read already in flight when it fires is not empty -- it is a
// Promise that resolves LATER, and its .then would otherwise write
// pre-invalidation data into the cache AFTER the clear, undoing it. This
// monotonic counter is bumped by every cache-emptying act (clearReadCache
// and the test-only resetApiCacheForTests) so apiGetCached/apiListCached
// can compare the epoch they started under against the epoch at resolution
// time and skip the write when it has moved on. The in-flight request's
// OWN caller still gets its answer either way -- only the cache write is
// dropped, never the returned value.
let cacheEpoch = 0;

// DEC_700: the mutation bump IS the cache's invalidation clock. Wired once,
// here, by subscription — every present and future mutating helper that
// calls bumpMutationVersion() (request()'s non-GET branch, apiUpload)
// invalidates the read cache for free. Do NOT add a second clear beside
// bumpMutationVersion() itself.
function clearReadCache(): void {
  readCache.clear();
  cacheEpoch += 1;
}
subscribeToMutationVersion(clearReadCache);

/** Test-only seam: empties the read cache between test cases. Never called
 * from production code (mirrors useCurrentEvent.ts's resetEventsCacheForTests). */
export function resetApiCacheForTests(): void {
  readCache.clear();
  cacheEpoch += 1;
}

export type ApiErrorCode = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'internal';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  fields?: Record<string, string>;

  constructor(status: number, code: ApiErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface ListEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  // DEC-913: present on the submissions worklist list envelope only — the
  // chips + re-uploaded headline ride the same response as the rows,
  // computed by one grouped aggregate server-side. Optional because other
  // apiList<T> callers' endpoints don't return these.
  contentStatusCounts?: { pending: number; approved: number; changes_requested: number };
  reuploadedCount?: number;
  // DEC-745 (wave-72 amendment): present on GET /plans/:id/progress only --
  // the plan editor's cap row reads its talks/reviews/reviewers summary off
  // this ONE number rather than re-deriving it client-side.
  submissionsInScope?: number;
  // DEC-027 wave-51 amendment: present on GET /tokens only -- the bound on
  // the org's bearer-token population, rendered beside the create control.
  max?: number;
  // DEC-596 (wave-61 amendment): present on GET /submissions/:id/evaluations
  // only -- the count of reviewers ASSIGNED to this submission, never the
  // count of evaluation rows they've submitted. The "Reviews · N of M in"
  // header's denominator must always read this, never items.length --
  // items.length is how the two arithmetics diverged in the first place.
  assigned?: number;
}

// DEC-024 (wave-19 amendment): a 401 anywhere on the wire is one policy in
// one place -- the SPA's session has expired/is absent, so the caller is
// sent to the login door. Guarded so a page hit by several concurrent 401s
// (e.g. a burst of requests firing when a session expires) only navigates
// once per page life. A 403 (signed in but no grant) deliberately does NOT
// redirect here -- see the res.status === 403 branches below.
let redirecting = false;
function redirectToLoginOnce(): void {
  if (redirecting) return;
  redirecting = true;
  window.location.assign('/login');
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'object' &&
    (body as { error: unknown }).error !== null
  );
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (method !== 'GET') {
    headers.set('x-chq-csrf', '1');
  }
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const res = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });

  const body = await parseBody(res);

  if (!res.ok) {
    // 403 (signed in, no grant) is left alone -- the forbidden message
    // renders inline; redirecting there would bounce a legitimately
    // signed-in user off the page they're looking at.
    if (res.status === 401) {
      redirectToLoginOnce();
    }
    if (isApiErrorBody(body)) {
      throw new ApiError(res.status, body.error.code, body.error.message, body.error.fields);
    }
    throw new ApiError(res.status, 'internal', `Request failed with status ${res.status}`);
  }

  // DEC-700: a successful mutation bumps the shared signal so any
  // exception badge derived from server state (e.g. nav's late/clash
  // counts) knows to refetch. GET never bumps — that would loop.
  if (method !== 'GET') {
    bumpMutationVersion();
  }

  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiList<T>(path: string): Promise<ListEnvelope<T>> {
  return request<ListEnvelope<T>>(path, { method: 'GET' });
}

// DEC_013: cached read helpers. Delegate to the SAME request() as
// apiGet/apiList (never a second fetch call) and write the resolved
// payload into the cache on success only — an ApiError throws before the
// cache write runs, so a failed read never poisons the cache.
export async function apiGetCached<T>(path: string): Promise<T> {
  const epochAtStart = cacheEpoch;
  const result = await request<T>(path, { method: 'GET' });
  // DEC_700: only write into the cache if no clear happened while this
  // request was in flight. The caller still gets `result` regardless --
  // this skip drops only the (now-stale) cache write, never the response.
  if (cacheEpoch === epochAtStart) {
    cacheSet(cacheKey(path), result);
  }
  return result;
}

export async function apiListCached<T>(path: string): Promise<ListEnvelope<T>> {
  const epochAtStart = cacheEpoch;
  const result = await request<ListEnvelope<T>>(path, { method: 'GET' });
  // DEC_700: see apiGetCached -- same epoch guard, same non-swallowing
  // guarantee that the caller's own result is never dropped.
  if (cacheEpoch === epochAtStart) {
    cacheSet(cacheKey(path), result);
  }
  return result;
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// The one PUT verb in this wire contract, shared by the two idempotent
// endpoints that need it: DEC-021's agenda slot write
// (submissions/:id/slot) and DEC-018's reviewer evaluation upsert
// (idempotent per plan + submission + reviewer + round). Mirrors
// apiPatch's shape; api.ts is the sole wire (DEC-024).
export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

// DEC-154/DEC-874 (wave-91 amendment): sign-out. Mirrors this module's own
// CSRF convention (x-chq-csrf header on mutations, credentials 'include')
// even though /logout isn't under /api/v1 -- it's not routed through
// request() because that helper hardcodes the /api/v1 prefix. This is the
// ONE sign-out contract; every caller (App.tsx's header/nav controls, the
// review phone dock) imports this rather than hand-copying the fetch.
//
// Only navigate to /login when the /logout response is ok. If it isn't (or
// the fetch itself throws), the chq_session cookie is still live
// server-side -- navigating to /login anyway would assert a sign-out that
// did not happen, silently leaving an authenticated session behind a page
// that looks signed-out. Instead this throws, so the rejection surfaces to
// the caller instead of being swallowed.
//
// DEC-154 (wave 158 amendment): navigate to the URL the server's redirect
// named, not a path this client re-invents. src/routes/auth-login.tsx
// redirects /logout's POST to /login?signed-out=1, and
// src/routes/auth-helpers.ts's loginStatusLine is the single owner that
// turns that query into the required confirmation line -- so a hardcoded
// `/login` silently drops the confirmation. fetch follows the redirect and
// exposes the final URL as res.url; use it, falling back to the literal
// `/login?signed-out=1` (the same literal the server and loginStatusLine
// already agree on) when res.url is absent or doesn't carry the query.
export async function signOut(): Promise<void> {
  const res = await fetch('/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-chq-csrf': '1' },
  });
  if (!res.ok) {
    throw new Error(`Sign-out failed: /logout responded ${res.status}`);
  }
  const destination = res.url && res.url.includes('signed-out=1') ? res.url : '/login?signed-out=1';
  window.location.assign(destination);
}

// DEC-160: POST that returns a binary body (application/zip) rather than
// JSON — the files-library bulk-download endpoint. Deliberately bypasses
// `request()`'s JSON parsing but mirrors its csrf + credentials + ApiError
// handling; on success returns the raw Blob plus the server's suggested
// filename (parsed from Content-Disposition) for the caller to trigger a
// browser download.
export async function apiPostBlob(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers({ 'content-type': 'application/json', 'x-chq-csrf': '1' });

  const res = await fetch(`${API_PREFIX}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 401) {
      redirectToLoginOnce();
    }
    const parsed = await parseBody(res);
    if (isApiErrorBody(parsed)) {
      throw new ApiError(res.status, parsed.error.code, parsed.error.message, parsed.error.fields);
    }
    throw new ApiError(res.status, 'internal', `Request failed with status ${res.status}`);
  }

  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? 'download.zip';
  const blob = await res.blob();
  return { blob, filename };
}

// DEC-024 / DEC-020: multipart upload helper for the Content SPA (file
// uploads). Deliberately bypasses `request()` because FormData must not get
// a manually-set content-type (the browser sets the multipart boundary);
// otherwise this mirrors request()'s csrf + credentials + ApiError handling.
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const headers = new Headers();
  headers.set('x-chq-csrf', '1');

  const res = await fetch(`${API_PREFIX}${path}`, {
    method: 'POST',
    body: form,
    headers,
    credentials: 'include',
  });

  const body = await parseBody(res);

  if (!res.ok) {
    if (res.status === 401) {
      redirectToLoginOnce();
    }
    if (isApiErrorBody(body)) {
      throw new ApiError(res.status, body.error.code, body.error.message, body.error.fields);
    }
    throw new ApiError(res.status, 'internal', `Request failed with status ${res.status}`);
  }

  // DEC-700 (wave-53 amendment): apiUpload is a mutating helper that
  // deliberately bypasses request() for the multipart content-type, but the
  // shared signal is owed to every non-GET success, not just request()'s
  // callers -- see api-mutation-bump.scan.test.ts.
  bumpMutationVersion();

  return body as T;
}
