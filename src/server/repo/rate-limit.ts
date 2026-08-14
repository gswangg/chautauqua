// DEC-948: the rate limiter's counter lives in D1, not KV. The prior
// implementation (src/lib/rate-limit.ts's KVStore-taking functions, now
// deleted -- no shim, house rule) did a KV get -> compare -> put:
// against an eventually-consistent store with no compare-and-set, N
// concurrent callers can all read count=0 and all pass. D1 supports a real
// atomic statement (`insert ... on conflict(key) do update set count =
// rate_limit.count + 1 returning count`), so the increment and the
// ok/deny decision both happen in the one write.
//
// DEC-180 (wave-29 amendment): the peek-then-conditionally-increment shape
// (peekScopedLimit + incrementScopedLimit, both deleted here -- no shim,
// house rule) was itself a get-then-put race: two concurrent requests can
// both peek under the cap before either increments, admitting N+1. The
// only atomic shape is CONSUME THEN REFUND -- checkAndIncrementScopedLimit
// spends one unit of budget unconditionally at admission time (one
// statement decides ok/deny off the row it just wrote), and callers that
// want a failures-only budget call refundScopedLimit afterward to give the
// unit back. A refund is a single `count = count - 1 where count > 0`
// statement -- never a select-then-write, so it can't itself race.
//
// `db: Db` first instead of `kv: KVStore`, identical return shapes. `key`
// is built by scopedRateLimitKey (still pure, src/lib/rate-limit.ts,
// DEC-457/DEC-002) so live bucket identity is unchanged across the
// migration.

import { and, eq, gt, lte, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../context";
import { scopedRateLimitKey } from "../../lib/rate-limit";

export interface ScopedRateLimitResult {
  ok: boolean;
  count: number;
}

interface ScopedLimitOpts {
  windowSeconds: number;
  max: number;
}

function windowBounds(now: number, windowSeconds: number): { windowStart: number; expiresAt: number } {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return { windowStart, expiresAt: windowStart + windowMs };
}

/** Bounded set-based prune of every expired bucket, issued alongside a
 * write -- never a scan, never a per-key sweep, never a cron. */
async function pruneExpired(db: Db, now: number): Promise<void> {
  await db.delete(schema.rateLimit).where(lte(schema.rateLimit.expiresAt, now));
}

/** Deletes the current window's counter row, clearing the budget. */
export async function resetScopedLimit(db: Db, scope: string, id: string, now: number, windowSeconds: number): Promise<void> {
  const { windowStart } = windowBounds(now, windowSeconds);
  const key = scopedRateLimitKey(scope, id, windowStart);
  await db.delete(schema.rateLimit).where(eq(schema.rateLimit.key, key));
}

/** Atomic check-and-increment: one `insert ... on conflict do update ...
 * returning count` statement decides ok/deny off the RETURNED count, so
 * concurrent callers land on distinct counts and exactly one crosses the
 * cap -- never a get-then-put race. */
export async function checkAndIncrementScopedLimit(
  db: Db,
  scope: string,
  id: string,
  now: number,
  opts: ScopedLimitOpts,
): Promise<ScopedRateLimitResult> {
  const { windowStart, expiresAt } = windowBounds(now, opts.windowSeconds);
  const key = scopedRateLimitKey(scope, id, windowStart);
  const rows = await db
    .insert(schema.rateLimit)
    .values({ key, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: schema.rateLimit.key,
      set: { count: sql`${schema.rateLimit.count} + 1` },
    })
    .returning({ count: schema.rateLimit.count });
  const count = rows[0]!.count;
  await pruneExpired(db, now);
  return { ok: count <= opts.max, count };
}

/** Gives back one unit of budget spent by a prior checkAndIncrementScopedLimit
 * call, in one atomic statement -- never a select first. `count > 0` guards
 * against driving a row negative if a refund races a prune/rollover. */
export async function refundScopedLimit(
  db: Db,
  scope: string,
  id: string,
  now: number,
  opts: { windowSeconds: number },
): Promise<void> {
  const { windowStart } = windowBounds(now, opts.windowSeconds);
  const key = scopedRateLimitKey(scope, id, windowStart);
  await db
    .update(schema.rateLimit)
    .set({ count: sql`${schema.rateLimit.count} - 1` })
    .where(and(eq(schema.rateLimit.key, key), gt(schema.rateLimit.count, 0)));
}
