// w1-a: nav-badge data source for the top-nav shell (DEC-369). Sourced from
// the retained overview aggregates speakers.overdueAssignments and
// agenda.conflicts — this hook declares its own local shape rather than
// importing app/src/pages/overview/cards.ts's OverviewPayload, because
// another lane deletes that file (Overview stops being a card grid,
// DEC-366/370). When the event isn't resolved yet or the request fails,
// the hook returns nulls; callers render no badge, which is "no known
// exception", not a swallowed error surfaced to the user.
import { useEffect, useState } from 'react';
import { apiGet } from './api';
import { useCurrentEvent } from './useCurrentEvent';

interface OverviewAggregatesPayload {
  speakers: { overdueAssignments: number };
  agenda: { conflicts: number };
}

export interface NavExceptions {
  late: number | null;
  clash: number | null;
}

const EMPTY: NavExceptions = { late: null, clash: null };

export function useNavExceptions(): NavExceptions {
  const { eventId } = useCurrentEvent();
  const [exceptions, setExceptions] = useState<NavExceptions>(EMPTY);

  useEffect(() => {
    if (!eventId) {
      setExceptions(EMPTY);
      return;
    }
    let cancelled = false;
    apiGet<OverviewAggregatesPayload>(`/events/${eventId}/overview`)
      .then((res) => {
        if (cancelled) return;
        setExceptions({ late: res.speakers.overdueAssignments, clash: res.agenda.conflicts });
      })
      .catch(() => {
        // Fail loudly happens at the source (Overview page's own fetch);
        // here in the shell, an unavailable count is absence of an
        // exception, per DEC-369.
        if (!cancelled) setExceptions(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return exceptions;
}
