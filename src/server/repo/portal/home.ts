// The participant home's data (multi-portal): every event's person view for
// one contact, plus each session's placement line. Lives behind the
// repo/portal barrel with the other portal readers so a route test can
// stand it in like getPortalData. Every read is keyed by the caller's own
// contactId (and org).

import type { Db } from "../../context";
import { buildPersonView, type PersonView } from "../portals/view";
import { reconcileEventPortals } from "../portals/reconcile";
import { listParticipationEventIds } from "../portals/participations";
import { sessionPlacementLine } from "../portals/invitations";
import { markSponsorContactsJoined } from "../sponsors/organizer";

export interface PortalHome {
  views: PersonView[];
  // submissionId -> "Tue 12 May · 10:00 · Room 2A · 30 min"
  placements: Map<string, string | null>;
}

/** Builds every event's view for one person. A view that finds an item
 * with no assignment row yet reconciles that event and rebuilds, so a change
 * the cron hasn't reached is never visible as an item that can't be opened.
 * `heal: false` (readers that only need permissions or resources) skips
 * that and the placement lines. */
export async function getPortalHome(
  db: Db,
  contactId: string,
  orgId: string,
  now: number,
  opts: { heal: boolean } = { heal: true },
): Promise<PortalHome> {
  if (opts.heal) {
    // a sponsor teammate joins their team the first time they open the
    // portal: their company section appears now, not at the next cron
    const joined = await markSponsorContactsJoined(db, contactId, new Date(now));
    for (const eventId of joined) await reconcileEventPortals(db, eventId, new Date(now), { notify: "auto" });
  }
  const eventIds = await listParticipationEventIds(db, contactId, orgId);
  // each event's view is independent: build them side by side
  const built = await Promise.all(
    eventIds.map(async (eventId) => {
      let view = await buildPersonView(db, { eventId, contactId, now });
      if (opts.heal && view.needsReconcile) {
        await reconcileEventPortals(db, eventId, new Date(now), { notify: "auto" });
        view = await buildPersonView(db, { eventId, contactId, now });
      }
      return view;
    }),
  );
  const views: PersonView[] = built.filter((view) => view.participations.length > 0);
  const placements = new Map<string, string | null>();
  if (opts.heal) {
    const submissionIds = [
      ...new Set(views.flatMap((v) => v.sections.map((s) => s.participation.session?.submissionId).filter((sid): sid is string => !!sid))),
    ];
    const lines = await Promise.all(submissionIds.map((sid) => sessionPlacementLine(db, sid)));
    submissionIds.forEach((sid, i) => placements.set(sid, lines[i] ?? null));
  }
  return { views, placements };
}
