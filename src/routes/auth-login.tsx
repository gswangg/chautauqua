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
  AUTH_RATE_LIMIT_WINDOW_SECONDS,
  AUTH_RATE_LIMIT_MAX,
  RATE_LIMIT_ERROR,
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
  // a per-account cap. Two independent checks: a per-email budget (catches
  // credential stuffing against one account) and a per-IP budget (catches
  // a single source hammering many accounts). Either failing blocks login.
  //
  // DEC-948 + DEC-180 (wave-29 amendment): CONSUME THEN REFUND. The budgets
  // are checked-and-incremented atomically, BEFORE the password derivation
  // runs — a read-only peek followed by a later increment lets N concurrent
  // requests all read the same pre-increment count and all reach the
  // expensive PBKDF2 derivation (the exact read-then-write race DEC-948
  // forbids). checkAndIncrement is one atomic D1 upsert, so concurrent
  // callers land on distinct counts and exactly one crosses the cap.
  //
  // DEC-180: a successful login must not consume the shared per-email
  // budget. Since the increment now happens up front (before we know the
  // outcome), a confirmed success gives the budget back afterward: the
  // per-identity bucket via resetScopedLimit and the per-IP bucket via the
  // atomic refundScopedLimit (both below).
  //
  // DEC-180 wave-29 corollary (1): the buckets are spent in sequence, not in
  // parallel, so that when the per-identity bucket ADMITS but the per-IP
  // bucket DENIES, the identity unit is refunded before the 429 — a request
  // that never reached verification must not spend the account's budget.
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const loginNow = Date.now();
  const userLimit = await checkAndIncrementScopedLimit(db, "login-user", email, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });

  if (!userLimit.ok) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    const demoIdentities = await loadDemoIdentitiesIfPresent(db);
    const singleEvent = await loadSingleEventContext(db);
    return c.html(
      <LoginPage
        csrfToken={csrfToken}
        error={RATE_LIMIT_ERROR}
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
    await refundScopedLimit(db, "login-user", email, loginNow, { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS });
    const { token: csrfToken } = ensureCsrfCookie(c);
    const demoIdentities = await loadDemoIdentitiesIfPresent(db);
    const singleEvent = await loadSingleEventContext(db);
    return c.html(
      <LoginPage
        csrfToken={csrfToken}
        error={RATE_LIMIT_ERROR}
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
        error="Invalid email or password."
        email={email}
        demoIdentities={demoIdentities}
        singleEvent={singleEvent}
      />,
      401,
    );
  }

  await resetScopedLimit(db, "login-user", email, loginNow, AUTH_RATE_LIMIT_WINDOW_SECONDS);
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
