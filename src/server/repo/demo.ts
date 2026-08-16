// DEC-583: the /login demo-credential prefill block renders only when the
// seeded demo accounts actually exist in this database (never on a real
// deployment) -- a single COUNT query, in its own repo module rather than
// src/server/repo/users.ts (contended per w2-c task scope).

import { eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";

/** True only when a user row exists for EVERY one of the given emails. One
 * eq()+limit(1) lookup per email (the demo set is fixed at 3, so this stays
 * a handful of point lookups rather than one big query) -- deliberately the
 * SAME simple `eq(user.email, ...)` shape every other single-column user
 * lookup in this codebase uses, rather than an inArray/count(*) query most
 * fake-db test doubles across the suite aren't built to emulate. DEMO_
 * IDENTITIES stores emails already lowercased (matching the fixture and
 * matching how the seed script + login lookup both write/read email). */
export async function demoIdentitiesPresent(db: Db, emails: readonly string[]): Promise<boolean> {
  if (emails.length === 0) return false;
  for (const email of new Set(emails.map((e) => e.toLowerCase()))) {
    // DEC-558 (wave 75): user_email_idx is a uniqueIndex on schema.user.email,
    // so this predicate already narrows to at most one row.
    const rows = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (rows.length === 0) return false;
  }
  return true;
}
