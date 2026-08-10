// DEC-024: SPA shared "current event" hook. Resolution order: ?eventId URL
// param -> localStorage 'chq.currentEventId' (same key the submissions-local
// useCurrentEventId.ts stand-in uses) -> fetch GET /api/v1/events and take
// items[0].id, persisting it. Errors surface loudly (no silent null).
import { useEffect, useState } from 'react';
import { apiList, ApiError } from './api';

const STORAGE_KEY = 'chq.currentEventId';

export interface UseCurrentEventResult {
  eventId: string | null;
  loading: boolean;
  error?: string;
}

interface EventListItem {
  id: string;
}

export function useCurrentEvent(): UseCurrentEventResult {
  const fromUrl = new URLSearchParams(window.location.search).get('eventId');
  const fromStorage = window.localStorage.getItem(STORAGE_KEY);

  const [eventId, setEventId] = useState<string | null>(fromUrl ?? fromStorage ?? null);
  const [loading, setLoading] = useState(eventId === null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (fromUrl) {
      window.localStorage.setItem(STORAGE_KEY, fromUrl);
      setEventId(fromUrl);
      setLoading(false);
      return;
    }
    if (fromStorage) {
      setEventId(fromStorage);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiList<EventListItem>('/events')
      .then((res) => {
        const first = res.items[0];
        if (!first) {
          setError('No events exist yet.');
          return;
        }
        window.localStorage.setItem(STORAGE_KEY, first.id);
        setEventId(first.id);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to resolve current event');
      })
      .finally(() => setLoading(false));
    // Deliberately runs once: URL/localStorage are read synchronously above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { eventId, loading, error };
}
