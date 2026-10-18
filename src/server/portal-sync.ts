// Multi-portal: reconcile an event's portals after a change that rules read
// (an acceptance, an invitation answer, a sponsor or event-role change)
// without holding up the response. The 15-minute cron (repo/portals/cron.ts)
// is the backstop, and the participant home reconciles itself when it finds
// an item with no assignment row, so a skipped run is never visible for long.

import type { Context } from "hono";
import type { AppEnv } from "./env";
import { reconcileEventPortals } from "./repo/portals/reconcile";
import { executionCtxOf } from "./execution-ctx";

export function scheduleReconcile(c: Context<AppEnv>, eventIds: (string | null | undefined)[]): void {
  const ids = [...new Set(eventIds.filter((id): id is string => typeof id === "string" && id !== ""))];
  if (ids.length === 0) return;
  const ctx = executionCtxOf(c);
  // no execution context (unit tests): the cron and the home cover it
  if (!ctx) return;
  const waitUntil = ctx.waitUntil.bind(ctx);
  const db = c.var.db;
  const now = new Date();
  waitUntil(
    (async () => {
      for (const id of ids) {
        try {
          await reconcileEventPortals(db, id, now, { notify: "auto" });
        } catch (err) {
          console.error("portal reconcile failed for event", id, err);
        }
      }
    })(),
  );
}
