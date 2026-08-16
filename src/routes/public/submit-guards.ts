// Request-level guards (rate limiting, same-origin check) for the public CFP
// submit flow (src/routes/public/submit.tsx). Split out purely to reduce
// merge contention on that file — no behavior change.

import { checkAndIncrementScopedLimit, refundScopedLimit } from "../../server/repo/rate-limit";
import type { Db } from "../../server/context";
import { DEC_072 } from "../../decisions";
// implements DEC_072 (identity-keyed budgets, and this wave's refund-on-
// server-failure amendment).
void DEC_072;

const EMAIL_BUDGET_WINDOW_SECONDS = 3600;

// DEC-072/DEC-057/DEC-038: per-email budget shared by every write path that
// mints a KV entry off a submitter-typed address. src/lib/rate-limit.ts's own
// doc comment (requestIpFromHeaders) states that x-forwarded-for is client-
// supplied and NOT a trustworthy identity, and that callers needing
// correctness must also key by a stable identity — this is that second key,
// factored once so save-draft and final-submit share one bucket-naming rule.
//
// DEC-072 (wave-58 amendment): `now` is a required caller-supplied argument
// (never Date.now() internally) so a later refundEmailBudget call for the
// same request lands in the EXACT SAME window bucket the spend did — a
// helper that reads the clock twice can't guarantee that.
export async function emailBudgetOk(
  db: Db,
  scope: "submit-email" | "draft-email",
  email: string,
  max: number,
  now: number,
): Promise<boolean> {
  const result = await checkAndIncrementScopedLimit(db, scope, email, now, {
    windowSeconds: EMAIL_BUDGET_WINDOW_SECONDS,
    max,
  });
  return result.ok;
}

// DEC-072 (wave-58 amendment)/DEC-180: gives back one unit spent by a prior
// emailBudgetOk call for the SAME (scope, email, now) triple. This is an
// identity-keyed budget (not the IP-keyed flood guard), so a transient
// failure on our own side (an R2 rejection, a DB write failure) must not
// count against a legitimate speaker's hourly allowance — mirrors
// auth-login.tsx's login-ip refund on exactly this reasoning.
export async function refundEmailBudget(
  db: Db,
  scope: "submit-email" | "draft-email",
  email: string,
  now: number,
): Promise<void> {
  await refundScopedLimit(db, scope, email, now, { windowSeconds: EMAIL_BUDGET_WINDOW_SECONDS });
}

// DEC-626/DEC-020: a cheap same-origin check runs BEFORE the body is ever
// parsed on the final-submit POST -- the Origin header (falling back to
// Referer when Origin is absent, matching ordinary browser behavior for
// same-site navigations/older UAs) must name the same host this request
// arrived on. When NEITHER header is present this fails OPEN (the
// double-submit CSRF token compared later remains the primary defense;
// some legitimate clients send neither header) -- only a header that is
// present and names a DIFFERENT host is treated as cross-origin.
export function isSameOriginSubmitPost(c: { req: { url: string; header(name: string): string | undefined } }): boolean {
  const candidate = c.req.header("Origin") ?? c.req.header("Referer");
  if (!candidate) return true;
  let candidateHost: string;
  try {
    candidateHost = new URL(candidate).host;
  } catch {
    return false;
  }
  return candidateHost === new URL(c.req.url).host;
}
