// Request-level guards (rate limiting, same-origin check) for the public CFP
// submit flow (src/routes/public/submit.tsx). Split out purely to reduce
// merge contention on that file — no behavior change.

import { checkAndIncrementScopedLimit } from "../../server/repo/rate-limit";
import type { Db } from "../../server/context";

// DEC-072/DEC-057/DEC-038: per-email budget shared by every write path that
// mints a KV entry off a submitter-typed address. src/lib/rate-limit.ts's own
// doc comment (requestIpFromHeaders) states that x-forwarded-for is client-
// supplied and NOT a trustworthy identity, and that callers needing
// correctness must also key by a stable identity — this is that second key,
// factored once so save-draft and final-submit share one bucket-naming rule.
export async function emailBudgetOk(
  db: Db,
  scope: "submit-email" | "draft-email",
  email: string,
  max: number,
): Promise<boolean> {
  const result = await checkAndIncrementScopedLimit(db, scope, email, Date.now(), {
    windowSeconds: 3600,
    max,
  });
  return result.ok;
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
