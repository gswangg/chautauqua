// DEC-013: SPA -> API client. Fetch wrapper: credentials 'include', sets
// x-chq-csrf on mutations, unwraps the list envelope, throws a typed
// ApiError on any error envelope. This is the ONLY module the SPA uses to
// talk to /api/v1 — page code must never call fetch() directly.

import { bumpMutationVersion } from './mutationSignal';

const API_PREFIX = '/api/v1';

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
