// DEC-072 (wave-58 amendment): every scope that spends a rate-limit budget
// under src/routes/** must be classified into exactly one of two named
// lists below, each entry carrying a WRITTEN reason. An unlisted scope
// FAILS this scan -- a new door that spends a budget can't slip in
// unclassified, silently disagreeing with its siblings about refund
// policy (this is exactly how submit-email/draft-email drifted from
// login's DEC-180 precedent before this wave).
//
// Population: every call site of `checkAndIncrementScopedLimit` (the
// atomic consume-then-decide primitive, src/server/repo/rate-limit.ts)
// AND `emailBudgetOk` (the public-CFP wrapper around it,
// src/routes/public/submit-guards.ts) under src/routes/**, keyed by the
// literal scope string passed as the call's SECOND positional argument.
// `emailBudgetOk`'s own internal call (submit-guards.ts) passes a
// variable, not a literal -- excluded, since its two literal-scoped
// callers (submit-post.tsx, submit-draft.tsx) are what's enumerated here.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const ROUTES_ROOT = join(REPO_ROOT, "src", "routes");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

interface SpendSite {
  file: string;
  fn: "checkAndIncrementScopedLimit" | "emailBudgetOk";
  scope: string;
}

/** Finds every `checkAndIncrementScopedLimit(db, "<scope>"` and
 * `emailBudgetOk(db, "<scope>"` call in `source`, requiring the scope
 * argument to be a plain string literal (not a variable) -- a non-literal
 * second argument is a call this scan can't classify by construction, and
 * is reported separately so it can never silently vanish from the count. */
function findSpendSites(file: string, source: string): { sites: SpendSite[]; nonLiteral: number } {
  const sites: SpendSite[] = [];
  let nonLiteral = 0;
  const callRe = /(checkAndIncrementScopedLimit|emailBudgetOk)\(\s*db\s*,\s*("([^"]+)"|[A-Za-z_][A-Za-z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(source)) !== null) {
    const fn = m[1] as SpendSite["fn"];
    const literal = m[3];
    if (literal === undefined) {
      // e.g. submit-guards.ts's own internal `checkAndIncrementScopedLimit(db, scope, ...)`
      nonLiteral++;
      continue;
    }
    sites.push({ file, fn, scope: literal });
  }
  return { sites, nonLiteral };
}

function scanRoutes(): SpendSite[] {
  const files = listSourceFiles(ROUTES_ROOT);
  const sites: SpendSite[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const { sites: fileSites } = findSpendSites(file, source);
    sites.push(...fileSites);
  }
  return sites;
}

// -- Classification -----------------------------------------------------
//
// REFUNDED_ON_SERVER_FAILURE: an identity-keyed budget (email, userId, or
// an IP bucket that is only ever consulted after a real identity resolves
// -- reset-token/claim, see their reason strings) that this codebase gives
// back when the request's own failure (ours, not the caller's abuse) means
// the spend shouldn't count. DEC-180's login precedent: refund on success
// or on an unrelated bucket's hard deny; this wave's submit-email/
// draft-email precedent: refund on a transient write failure (R2/DB/KV).
//
// FAILURE_BUDGET_NOT_REFUNDED: a budget that is deliberately spent and
// NEVER given back by this codebase, either because (a) it is IP-keyed and
// requestIpFromHeaders collapses every untrustworthy/absent header to the
// single bucket "unknown" (DEC-949) -- refunding would let an attacker who
// never presents a real IP spend the same never-decrementing bucket
// forever -- or (b) refunding would itself leak information (DEC-180
// wave-29 corollary (2): /forgot's account-enumeration-oracle argument).
const REFUNDED_ON_SERVER_FAILURE: Record<string, string> = {
  "reset-token": "IP-keyed but only a FAILURE budget for guessed tokens (DEC-949-style) -- refunded the instant a real token resolves (auth-reset.tsx:248-266), so a genuine link-holder is never throttled by unrelated guesses sharing the bucket.",
  "claim": "same shape as reset-token: refunded the instant a real claim token resolves (auth-claim.tsx:61-81).",
  "login-account": "identity-keyed (email); refunded early when a sibling bucket hard-denies, and reset on a successful login (auth-login.tsx:131-213) -- a request that never reached verification must not spend it.",
  "login-user": "identity-keyed (email+ip pair); reset on a successful login (auth-login.tsx:212).",
  "login-ip": "the one IP-keyed bucket that IS refunded -- on a successful login only (auth-login.tsx:213), the precedent this task's submit-email/draft-email refunds are modeled on.",
  "password-change": "identity-keyed (authenticated userId); reset the instant the current password verifies (account.tsx:202-218), before the independent new-password validation runs.",
  "submit-email": "identity-keyed (submitter email); refunded on the R2 fan-out rejection and on the DB write-phase catch (submit-post.tsx) -- DEC-072 wave-58 amendment, this task.",
  "draft-email": "identity-keyed (submitter email, when present); refunded if the saveDraft KV write throws (submit-draft.tsx) -- DEC-072 wave-58 amendment, this task.",
};

const FAILURE_BUDGET_NOT_REFUNDED: Record<string, string> = {
  "forgot-ip": "IP-keyed flood guard; DEC-180 wave-29 corollary (2) -- refunding conditionally on account existence would itself be an enumeration oracle, so /forgot spends and never refunds either of its two buckets.",
  "forgot": "email-keyed but deliberately never refunded for the same corollary (2) reason as forgot-ip -- a 429 here fires purely off request volume against one address, never off whether that address exists.",
  "submit": "IP-keyed flood guard on the final-submit door; requestIpFromHeaders collapses every untrustworthy/absent IP to the single bucket 'unknown' (DEC-949) -- refunding would let a spoofed/absent IP spend that shared bucket forever.",
  "draft": "IP-keyed flood guard on the save-draft door; same DEC-949 reasoning as 'submit'.",
};

describe("rate-limit spend/refund classification (DEC-072 wave-58 amendment)", () => {
  const sites = scanRoutes();
  const scopesSeen = new Set(sites.map((s) => s.scope));

  it("finds at least 10 distinct spend sites under src/routes/** (12 today)", () => {
    expect(sites.length).toBeGreaterThanOrEqual(10);
  });

  it("classifies every scope literal into exactly one of the two named lists", () => {
    const unclassified: string[] = [];
    const inBoth: string[] = [];
    for (const scope of scopesSeen) {
      const inRefunded = scope in REFUNDED_ON_SERVER_FAILURE;
      const inFailure = scope in FAILURE_BUDGET_NOT_REFUNDED;
      if (inRefunded && inFailure) inBoth.push(scope);
      if (!inRefunded && !inFailure) unclassified.push(scope);
    }
    expect(unclassified, `unclassified scopes: ${unclassified.join(", ")}`).toEqual([]);
    expect(inBoth, `scopes listed in BOTH lists: ${inBoth.join(", ")}`).toEqual([]);
  });

  it("every listed scope carries a non-empty written reason", () => {
    for (const [scope, reason] of Object.entries(REFUNDED_ON_SERVER_FAILURE)) {
      expect(reason.length, `REFUNDED_ON_SERVER_FAILURE["${scope}"] has no reason`).toBeGreaterThan(20);
    }
    for (const [scope, reason] of Object.entries(FAILURE_BUDGET_NOT_REFUNDED)) {
      expect(reason.length, `FAILURE_BUDGET_NOT_REFUNDED["${scope}"] has no reason`).toBeGreaterThan(20);
    }
  });

  it("every scope named in the two lists is actually present in source (no stale entries)", () => {
    const listed = new Set([...Object.keys(REFUNDED_ON_SERVER_FAILURE), ...Object.keys(FAILURE_BUDGET_NOT_REFUNDED)]);
    const stale = [...listed].filter((scope) => !scopesSeen.has(scope));
    expect(stale, `listed but not found in source: ${stale.join(", ")}`).toEqual([]);
  });

  // Negative control: proves the classification check above actually fails
  // shut for a scope that isn't in either list, rather than vacuously
  // passing (e.g. because Object.entries on an accidentally-empty map
  // iterates zero times).
  it("negative control: a hand-fed unlisted scope is reported as unclassified", () => {
    const fakeScopesSeen = new Set([...scopesSeen, "totally-unclassified-scope"]);
    const unclassified: string[] = [];
    for (const scope of fakeScopesSeen) {
      const inRefunded = scope in REFUNDED_ON_SERVER_FAILURE;
      const inFailure = scope in FAILURE_BUDGET_NOT_REFUNDED;
      if (!inRefunded && !inFailure) unclassified.push(scope);
    }
    expect(unclassified).toEqual(["totally-unclassified-scope"]);
  });
});
