// w1-a: nav-badge data source for the top-nav shell (DEC-369). Sourced from
// the retained overview aggregates speakers.overdueAssignments and
// agenda.conflicts — this hook declares its own local shape rather than
// importing app/src/pages/overview/cards.ts's OverviewPayload, because
// another lane deletes that file (Overview stops being a card grid,
// DEC-366/370). When the event isn't resolved yet or the request fails,
// the hook returns nulls; callers render no badge, which is "no known
// exception", not a swallowed error surfaced to the user.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiGet } from './api';
import { useCurrentEvent } from './useCurrentEvent';
import { useMe } from './useMe';
import { useMutationVersion } from './mutationSignal';

interface OverviewAggregatesPayload {
  speakers: { overdueAssignments: number };
  agenda: { conflicts: number };
}

export interface NavExceptions {
  late: number | null;
  clash: number | null;
}

const EMPTY: NavExceptions = { late: null, clash: null };

// w5-e/DEC-745 amendment: a dirty editor's unsaved-draft guard previously
// only covered its OWN back-link/Cancel controls -- clicking the chrome
// nav's Review link navigated away silently. This module-level registry
// (not React state -- consulted synchronously at click time, never a
// re-render trigger) lets a page register the same "confirm before
// leaving" guard the global nav shell (App.tsx's NavLinks) consults before
// every chrome nav-link navigation, so ANY exit from a dirty editor -- not
// just its own controls -- asks first.
type LeaveGuard = (proceed: () => void) => void;
let activeLeaveGuard: LeaveGuard | null = null;

/** Called by the page that owns the dirty-state guard (e.g. PlanEditor); pass null to clear on unmount. */
export function setNavLeaveGuard(guard: LeaveGuard | null): void {
  activeLeaveGuard = guard;
}

/** Called by chrome-nav click handlers before navigating -- runs `proceed` immediately when no guard is registered. */
export function guardedNavigate(proceed: () => void): void {
  if (activeLeaveGuard) activeLeaveGuard(proceed);
  else proceed();
}

export function useNavExceptions(): NavExceptions {
  const { eventId } = useCurrentEvent();
  const { me, loading: meLoading } = useMe();
  const mutationVersion = useMutationVersion();
  const { pathname } = useLocation();
  const [exceptions, setExceptions] = useState<NavExceptions>(EMPTY);

  useEffect(() => {
    // DEC-395: reviewers have no access to overview aggregates and no use
    // for late/clash badges (their sole section is Review) — only issue
    // the request once role is known to be 'organizer'.
    if (meLoading || me?.role !== 'organizer' || !eventId) {
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
    // DEC-700: refetch whenever a mutation elsewhere resolved (mutationVersion)
    // or the user navigated (pathname) — either can invalidate the badge's
    // stale answer, not just an eventId/role change.
  }, [eventId, meLoading, me?.role, mutationVersion, pathname]);

  return exceptions;
}
