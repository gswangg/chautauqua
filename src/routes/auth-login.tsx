// Login/logout routes extracted from src/routes/auth.tsx (contention
// decomposition, no behavior change). Mounted at "/" by auth.tsx.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { csrfForm, csrfFormOrHeader } from "../server/middleware";
import * as schema from "../db/schema";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../auth/password";
import { hashToken } from "../auth/tokens";
import { issueSession } from "../server/auth-session";
import {
  buildSessionCookie,
  clearSessionCookie,
  parseCookies,
  isSecureRequest,
  SESSION_COOKIE_NAME,
} from "../auth/cookies";
import { requestIpFromHeaders } from "../lib/rate-limit";
import {
  checkAndIncrementScopedLimit,
  refundScopedLimit,
  resetScopedLimit,
} from "../server/repo/rate-limit";
import { LoginPage } from "./auth-views";
import {
  ensureCsrfCookie,
  loadDemoIdentitiesIfPresent,
  loadSingleEventContext,
  loginStatusLine,
  loginIdentityKey,
  loginAccountKey,
  AUTH_RATE_LIMIT_WINDOW_SECONDS,
  AUTH_RATE_LIMIT_MAX,
  AUTH_ACCOUNT_RATE_LIMIT_MAX,
  RATE_LIMIT_BAND,
  LOGIN_REJECTED,
} from "./auth-helpers";
import { DEC_004, DEC_180 } from "../decisions";

void DEC_004;
void DEC_180;

export const loginRoutes = new Hono<AppEnv>();

loginRoutes.get("/login", async (c) => {
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  const demoIdentities = await loadDemoIdentitiesIfPresent(c.var.db);
  const singleEvent = await loadSingleEventContext(c.var.db);
  const statusLine = loginStatusLine(c.req.url);
  return c.html(
    <LoginPage
      csrfToken={csrfToken}
      demoIdentities={demoIdentities}
      singleEvent={singleEvent}
      statusLine={statusLine}
    />,
  );
});

loginRoutes.post("/login", csrfForm, async (c) => {
  const db = c.var.db;
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  // DEC-072: key by identity, not just IP — a shared-bucket per-IP counter
  // lets one attacker lock out every account behind that IP (e.g. NAT,
  // office network), and lets an attacker rotate x-forwarded-for to bypass
  // a per-account cap. Two hard, spoof-proof-adjacent checks plus one soft
  // account-wide budget, spent IN ORDER: a per-(email,ip) pair budget
  // (catches credential stuffing from one source against one account), a
  // per-IP budget (catches a single source hammering many accounts), and
  // an account-wide budget (bare email — the only bucket keyed purely on a
  // stable identity value per rate-limit.ts's own doc-comment, since the
  // other two are functions of a header the client controls).
  //
  // DEC-072 wave-38 amendment: the account-wide budget (loginAccountKey,
  // bare email, max AUTH_ACCOUNT_RATE_LIMIT_MAX=50) is STILL checked and
  // incremented atomically first (DEC-948 forbids turning this into a
  // read-then-write peek), but exhausting it no longer hard-denies the
  // request with a 429. A bare-email key is attacker-rotatable
  // (x-forwarded-for), which means a stranger who merely knows a victim's
  // address can drive this bucket to its cap from anywhere -- and unlike
  // the pair/IP buckets there is NO unlock path (the victim's own correct
  // password comes from their own IP, which this key ignores), so a hard
  // 429 here locked the real owner out of their own account with no
  // recourse. The bucket's exhaustion is now recorded in `accountExhausted`
  // and consulted only AFTER password verification: a WRONG password while
  // exhausted still returns 429 (the budget still throttles brute force),
  // but the CORRECT password always succeeds. See decisions/DEC-072.md
  // wave-38 amendment for the full ruling and the account.tsx precedent.
  //
  // The wave-54 pair budget (loginIdentityKey, email+IP) is keyed on
  // email+IP together, not the bare email — a bare-email key let a
  // stranger who merely knows a valid organizer address exhaust that
  // address's shared budget from anywhere and lock the real owner out with
  // no unlock path. Keying on email|ip confines the exhaustion to the
  // attacker's own IP; the victim's own IP still admits their attempts.
  // This bucket keeps its existing HARD pre-verification 429.
  //
  // DEC-948 + DEC-180 (wave-29 amendment): CONSUME THEN REFUND. The budgets
  // are checked-and-incremented atomically, BEFORE the password derivation
  // runs — a read-only peek followed by a later increment lets N concurrent
  // requests all read the same pre-increment count and all reach the
  // expensive PBKDF2 derivation (the exact read-then-write race DEC-948
  // forbids). checkAndIncrement is one atomic D1 upsert, so concurrent
  // callers land on distinct counts and exactly one crosses the cap.
  //
  // DEC-180: a successful login must not consume any of the shared
  // budgets. Since the increment now happens up front (before we know the
  // outcome), a confirmed success gives the budget back afterward: the
  // account and per-identity buckets via resetScopedLimit and the per-IP
  // bucket via the atomic refundScopedLimit (both below).
  //
  // DEC-180 wave-29 corollary (1), extended wave-66: the buckets are spent
  // in sequence, not in parallel, so that when an earlier bucket ADMITS but
  // a later bucket DENIES, every unit already spent in this request is
  // refunded before the 429 — a request that never reached verification
  // must not spend any account's budget. The account bucket is still
  // refunded here on a later HARD deny (pair or IP), even though its own
  // exhaustion is no longer a hard deny -- a request that never reached
  // verification must not leave the account bucket advanced regardless of
  // which kind of check ultimately rejected it.
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const accountKey = loginAccountKey(email);
  const identityKey = loginIdentityKey(email, ip);
  const loginNow = Date.now();

  const accountLimit = await checkAndIncrementScopedLimit(db, "login-account", accountKey, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_ACCOUNT_RATE_LIMIT_MAX,
  });
  const accountExhausted = !accountLimit.ok;

  const userLimit = await checkAndIncrementScopedLimit(db, "login-user", identityKey, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });

  if (!userLimit.ok) {
    await refundScopedLimit(db, "login-account", accountKey, loginNow, { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS });
    const { token: csrfToken } = ensureCsrfCookie(c);
    const demoIdentities = await loadDemoIdentitiesIfPresent(db);
    const singleEvent = await loadSingleEventContext(db);
    return c.html(
      <LoginPage
        csrfToken={csrfToken}
        error={RATE_LIMIT_BAND}
        email={email}
        demoIdentities={demoIdentities}
        singleEvent={singleEvent}
      />,
      429,
    );
  }

  const ipLimit = await checkAndIncrementScopedLimit(db, "login-ip", ip, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: 100,
  });

  if (!ipLimit.ok) {
    await refundScopedLimit(db, "login-account", accountKey, loginNow, { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS });
    await refundScopedLimit(db, "login-user", identityKey, loginNow, { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS });
    const { token: csrfToken } = ensureCsrfCookie(c);
    const demoIdentities = await loadDemoIdentitiesIfPresent(db);
    const singleEvent = await loadSingleEventContext(db);
    return c.html(
      <LoginPage
        csrfToken={csrfToken}
        error={RATE_LIMIT_BAND}
        email={email}
        demoIdentities={demoIdentities}
        singleEvent={singleEvent}
      />,
      429,
    );
  }

  // DEC-558: at most one row by construction — `user_email_idx` is a
  // uniqueIndex on schema.user.email, and `email` above is already
  // trim().toLowerCase()'d to match how it's stored.
  const rows = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const user = rows[0];
  // DEC-004 (wave 58 amendment): always run exactly one derivation, whether
  // or not the email matched a user, so an unknown email pays the same
  // PBKDF2 cost as a known one — closing the login timing oracle.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    // Budgets were already spent atomically at admission above, before the
    // derivation ran — nothing further to record on failure. The pair/IP
    // buckets already hard-denied above; the account-wide bucket's
    // exhaustion is only consulted now (DEC-072 wave-38 amendment) so a
    // stranger who never supplies the correct password still gets
    // throttled by it, but the real owner is never blocked before their
    // correct password can be checked.
    const { token: csrfToken } = ensureCsrfCookie(c);
    const demoIdentities = await loadDemoIdentitiesIfPresent(db);
    const singleEvent = await loadSingleEventContext(db);
    return c.html(
      <LoginPage
        csrfToken={csrfToken}
        error={accountExhausted ? RATE_LIMIT_BAND : LOGIN_REJECTED}
        email={email}
        demoIdentities={demoIdentities}
        singleEvent={singleEvent}
      />,
      accountExhausted ? 429 : 401,
    );
  }

  await resetScopedLimit(db, "login-account", accountKey, loginNow, AUTH_RATE_LIMIT_WINDOW_SECONDS);
  await resetScopedLimit(db, "login-user", identityKey, loginNow, AUTH_RATE_LIMIT_WINDOW_SECONDS);
  await refundScopedLimit(db, "login-ip", ip, loginNow, { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS });

  const now = new Date();
  const presentedCookies = parseCookies(c.req.header("cookie") ?? null);
  const presentedToken = presentedCookies[SESSION_COOKIE_NAME];
  const presentedTokenHash = presentedToken ? await hashToken(presentedToken) : null;
  const token = await issueSession(db, user.id, now, presentedTokenHash);

  c.header("Set-Cookie", buildSessionCookie(token, { secure: isSecureRequest(c.req.url) }));
  const dest = user.role === "speaker" ? "/portal" : "/admin";
  return c.redirect(dest, 302);
});

// DEC-154 (wave 25 amendment): /logout has no screen. A bookmarked GET
// must never sign anyone out (a bare GET side effect is a CSRF hole --
// <img src="/logout"> would sign a producer out), so it mutates nothing
// and redirects straight to /login. POST keeps its CSRF guard and session
// delete, then redirects to /login?signed-out=1 -- the sign-in card is the
// one place that status is read (loginStatusLine in ./auth-helpers).
loginRoutes.get("/logout", async (c) => {
  return c.redirect("/login", 302);
});

loginRoutes.post("/logout", csrfFormOrHeader, async (c) => {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const token = cookies[SESSION_COOKIE_NAME];
  if (token) {
    const tokenHash = await hashToken(token);
    await c.var.db.delete(schema.authSession).where(eq(schema.authSession.tokenHash, tokenHash));
  }
  c.header("Set-Cookie", clearSessionCookie({ secure: isSecureRequest(c.req.url) }));
  return c.redirect("/login?signed-out=1", 302);
});
