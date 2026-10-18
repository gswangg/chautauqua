// The portals' share of the 15-minute cron: reconcile every live event (a
// backstop for any change that didn't trigger a reconcile itself), then send
// the queued "new in your portal" emails. Per-event failures are collected
// and rethrown once, like runDueReminders.

import { gte } from "drizzle-orm";
import type { Bindings } from "../../env";
import { makeDb, makeMailer } from "../../context";
import * as schema from "../../../db/schema";
import type { KVStore } from "../../../auth/claim";
import { resolveBaseUrlForCron } from "../../origin";
import { countOf } from "../../../domain/count-copy";
import { reconcileEventPortals } from "./reconcile";
import { sendQueuedPortalNotifications } from "./notify";

export async function runPortalUpkeep(env: Bindings): Promise<void> {
  const db = makeDb(env);
  const now = new Date();
  const kv = env.KV as unknown as KVStore;
  const origin = resolveBaseUrlForCron(env);
  // events that haven't ended (two days' slack covers every timezone)
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const events = await db.select({ id: schema.event.id }).from(schema.event).where(gte(schema.event.endDate, cutoff));
  const failed: string[] = [];
  for (const { id } of events) {
    try {
      await reconcileEventPortals(db, id, now, { notify: "auto" });
      await sendQueuedPortalNotifications(db, makeMailer(db, env), id, now, kv, origin);
    } catch (err) {
      console.error("portal upkeep failed for event", id, err);
      failed.push(id);
    }
  }
  if (failed.length > 0) throw new Error(`runPortalUpkeep: ${countOf(failed.length, "event")} failed: ${failed.join(", ")}`);
}
