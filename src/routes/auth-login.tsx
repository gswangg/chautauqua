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
  // a per-account cap. Three independent checks, spent IN ORDER: a
  // spoof-proof per-account budget (bare email — the only bucket that
  // satisfies rate-limit.ts's own "MUST key on a stable identity value"
  // doc-comment, since the other two are functions of a header the client
  // controls), a per-(email,ip) pair budget (catches credential stuffing
  // from one source against one account), and a per-IP budget (catches a
  // single source hammering many accounts). Any one failing blocks login.
  //
  // DEC-072 wave-66 amendment: the account budget (loginAccountKey, bare
  // email, max AUTH_ACCOUNT_RATE_LIMIT_MAX=50) returns beside the wave-54
  // pair budget rather than replacing it — the pair budget alone left NO
  // bucket keyed purely on identity, so rotating x-forwarded-for bought
  // unlimited guesses against a known address. The account bucket's wider
  // window (50 vs 20) means an honest owner mistyping their password from
  // their own IP cannot reach it before the tighter pair bucket already
  // would.
  //
  // DEC-072 wave-54 amendment: the per-identity pair budget is keyed on
  // email+IP (loginIdentityKey in ./auth-helpers), not the bare email — a
  // bare-email key let a stranger who merely knows a valid organizer
  // address exhaust that address's shared budget from anywhere and lock
  // the real owner out with no unlock path. Keying on email|ip confines
  // the exhaustion to the attacker's own IP; the victim's own IP still
  // admits their attempts.
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
  // must not spend any account's budget.
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const accountKey = loginAccountKey(email);
  const identityKey = loginIdentityKey(email, ip);
  const loginNow = Date.now();

  const accountLimit = await checkAndIncrementScopedLimit(db, "login-account", accountKey, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_ACCOUNT_RATE_LIMIT_MAX,
  });

  if (!accountLimit.ok) {
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

  const rows = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const user = rows[0];
  // DEC-004 (wave 58 amendment): always run exactly one derivation, whether
  // or not the email matched a user, so an unknown email pays the same
  // PBKDF2 cost as a known one — closing the login timing oracle.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    // Budgets were already spent atomically at admission above, before the
    // derivation ran — nothing further to record on failure.
    const { token: csrfToken } = ensureCsrfCookie(c);
    const demoIdentities = await loadDemoIdentitiesIfPresent(db);
    const singleEvent = await loadSingleEventContext(db);
    return c.html(
      <LoginPage
        csrfToken={csrfToken}
        error={LOGIN_REJECTED}
        email={email}
        demoIdentities={demoIdentities}
        singleEvent={singleEvent}
      />,
      401,
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
  c.header("Set-Cookie", clearSessionCookie());
  return c.redirect("/login?signed-out=1", 302);
});
