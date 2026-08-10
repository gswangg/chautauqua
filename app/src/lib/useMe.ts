// DEC-024: SPA shared "who am I" hook, via GET /api/v1/me.
import { useEffect, useState } from 'react';
import { apiGet, ApiError } from './api';

export interface Me {
  userId: string;
  email: string;
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
        // Fail loudly: an unauthenticated/broken session should not look
        // like a silently-empty "no user" state to callers debugging it.
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
