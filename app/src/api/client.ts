const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw new ApiError(res.status, body);
  }

  return body as T;
}
