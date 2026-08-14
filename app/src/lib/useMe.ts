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
        // Fail loudly: an unauthenticated/broken session should not look
        // like a silently-empty "no user" state to callers debugging it.
        // Same policy the Worker's /admin gate already enforces for an
        // anonymous request: a 401 sends the caller to the login door
        // rather than rendering an app frame with no signed-in user.
        // setMe(null) still runs so nothing renders in the frame between
        // the assign() call and the browser unloading for /login.
        if (err instanceof ApiError && err.status === 401) {
          setMe(null);
          window.location.assign('/login');
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
