// DEC-024: SPA shared "who am I" hook, via GET /api/v1/me.
import { useEffect, useState } from 'react';
import { apiGet, ApiError } from './api';

export interface Me {
  userId: string;
  email: string;
  // DEC-576: first + last name from the signed-in user's linked contact,
  // null when the user has no linked contact (or no name on file).
  name: string | null;
  role: string;
  orgId: string;
  contactId?: string;
}

export interface UseMeResult {
  me: Me | null;
  loading: boolean;
}

export function useMe(): UseMeResult {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<Me>('/me')
      .then((result) => {
        if (!cancelled) setMe(result);
      })
      .catch((err) => {
        if (cancelled) return;
        // DEC-024 (wave-19 amendment): the 401 -> /login redirect is one
        // policy owned by api.ts's request(), not duplicated here (a
        // second reader of the same policy). setMe(null) still runs so
        // nothing renders in the frame between api.ts's assign() call and
        // the browser unloading for /login. Any other error still fails
        // loudly rather than looking like a silently-empty "no user" state.
        if (err instanceof ApiError && err.status === 401) {
          setMe(null);
          return;
        }
        throw err;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { me, loading };
}
