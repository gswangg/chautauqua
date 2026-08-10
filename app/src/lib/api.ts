// DEC-013: SPA -> API client. Fetch wrapper: credentials 'include', sets
// x-chq-csrf on mutations, unwraps the list envelope, throws a typed
// ApiError on any error envelope. This is the ONLY module the SPA uses to
// talk to /api/v1 — page code must never call fetch() directly.

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
    if (isApiErrorBody(body)) {
      throw new ApiError(res.status, body.error.code, body.error.message, body.error.fields);
    }
    throw new ApiError(res.status, 'internal', `Request failed with status ${res.status}`);
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

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

// DEC-018's reviewer evaluation upsert is a PUT (idempotent per plan +
// submission + reviewer + round), unlike every other mutation in this
// wire contract, so this mirrors apiPatch's shape for that one endpoint.
export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
