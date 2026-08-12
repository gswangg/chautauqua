// Auth routes per DEC-005 (route map) + DEC-012 (SSR login) + DEC-014 (claim
// flow). Route files export a named Hono sub-app; only src/index.ts mounts
// it (DEC-012). Handlers stay thin: parse/authz -> repo query -> response.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { csrfForm, csrfFormOrHeader } from "../server/middleware";
import { ApiError } from "../server/http";
import * as schema from "../db/schema";
import { newId } from "../domain/ids";
import { hashPassword, verifyPassword } from "../auth/password";
import { newSessionToken, hashToken } from "../auth/tokens";
import {
  buildSessionCookie,
  buildCsrfCookie,
  clearSessionCookie,
  parseCookies,
  newCsrfToken,
  isSecureRequest,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../auth/cookies";
import { consumeClaimToken, readClaimToken, type KVStore } from "../auth/claim";
import { findAccountUserId } from "../server/repo/comms";
import {
  checkAndIncrementScopedLimit,
  peekScopedLimit,
  incrementScopedLimit,
  resetScopedLimit,
  requestIpFromHeaders,
} from "../lib/rate-limit";
import { ThemeStyles } from "../views/theme";
import { AUTH_CSS } from "./auth.css";

const AUTH_RATE_LIMIT_WINDOW_SECONDS = 900;
const AUTH_RATE_LIMIT_MAX = 20;
const RATE_LIMIT_ERROR = "Too many attempts. Try again in a few minutes.";

export const authRoutes = new Hono<AppEnv>();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function ensureCsrfCookie(c: {
  req: { header(name: string): string | undefined; url: string };
}): {
  token: string;
  setCookieIfNew: string | null;
} {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return {
    token,
    setCookieIfNew: buildCsrfCookie(token, { secure: isSecureRequest(c.req.url) }),
  };
}

// DEC-367/371/373/374: /login and /claim/:token are SSR surfaces
// re-skinned to the paper-card auth pattern from docs/design/Chautauqua
// Account.dc.html ("One door, three roles" + the 390 mobile frame) — a
// centred card on --chq-paper, 660px measure on desktop, full-width on
// phone, wordmark, one filled primary button, error text as plain type
// (no red banner: DEC-367 forbids red anywhere). ThemeStyles() supplies
// the shared tokens/reset/button/input rules; AUTH_CSS (src/routes/
// auth.css.ts) adds the auth-card layout that no other SSR surface
// needs. Both are injected via dangerouslySetInnerHTML, never as a JSX
// text child (DEC-374 escaping trap).
function AuthHead(props: { title: string }) {
  return (
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{props.title}</title>
      <ThemeStyles />
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
    </head>
  );
}

function LoginPage(props: { csrfToken: string; error?: string }) {
  return (
    <html lang="en">
      <AuthHead title="Log in - Chautauqua" />
      <body>
        <div className="chq-auth-card">
          <div>
            <span className="chq-auth-wordmark">chautauqua</span>
            <div className="chq-auth-subtitle">Sign in to your account</div>
          </div>
          {props.error ? (
            <p className="chq-auth-error" role="alert">
              {props.error}
            </p>
          ) : null}
          <form
            className="chq-auth-fields"
            method="post"
            action="/login"
            onsubmit="var b=document.getElementById('chq-login-submit');if(b){b.disabled=true;b.textContent='Signing in…';}"
          >
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <label>
              <span className="chq-auth-label">Email</span>
              <input className="chq-input" type="email" name="email" required autofocus />
            </label>
            <label>
              <span className="chq-auth-label">Password</span>
              <input className="chq-input" type="password" name="password" required />
            </label>
            <button type="submit" id="chq-login-submit" className="chq-btn-primary">
              Sign in
            </button>
          </form>
        </div>
      </body>
    </html>
  );
}

function ClaimPage(props: { csrfToken: string; error?: string }) {
  return (
    <html lang="en">
      <AuthHead title="Create your password - Chautauqua" />
      <body>
        <div className="chq-auth-card">
          <div>
            <span className="chq-auth-wordmark">chautauqua</span>
            <div className="chq-auth-subtitle">Create a password to track your submission</div>
          </div>
          {props.error ? (
            <p className="chq-auth-error" role="alert">
              {props.error}
            </p>
          ) : null}
          <form className="chq-auth-fields" method="post">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <label>
              <span className="chq-auth-label">Password</span>
              <input className="chq-input" type="password" name="password" minlength={8} required />
            </label>
            <button type="submit" className="chq-btn-primary">
              Create password
            </button>
          </form>
        </div>
      </body>
    </html>
  );
}

authRoutes.get("/login", (c) => {
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<LoginPage csrfToken={csrfToken} />);
});

authRoutes.post("/login", csrfForm, async (c) => {
  const kv = c.env.KV as unknown as KVStore;
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
  // DEC-180: the counters only advance on FAILED attempts — a successful
  // login must not consume the shared budget, so we peek (read-only) before
  // verifying the password, and only increment after a failure is
  // confirmed. On success the per-email budget is cleared entirely.
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const loginNow = Date.now();
  const userPeek = await peekScopedLimit(kv, "login-user", email, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });
  const ipPeek = await peekScopedLimit(kv, "login-ip", ip, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: 100,
  });
  if (!userPeek.ok || !ipPeek.ok) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<LoginPage csrfToken={csrfToken} error={RATE_LIMIT_ERROR} />, 429);
  }

  const db = c.var.db;

  const rows = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await incrementScopedLimit(kv, "login-user", email, loginNow, {
      windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: AUTH_RATE_LIMIT_MAX,
    });
    await incrementScopedLimit(kv, "login-ip", ip, loginNow, {
      windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: 100,
    });
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<LoginPage csrfToken={csrfToken} error="Invalid email or password." />, 401);
  }

  await resetScopedLimit(kv, "login-user", email, loginNow, AUTH_RATE_LIMIT_WINDOW_SECONDS);

  const token = newSessionToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  await db.insert(schema.authSession).values({
    id: newId(),
    userId: user.id,
    tokenHash,
    expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
    createdAt: now,
    updatedAt: now,
  });

  c.header("Set-Cookie", buildSessionCookie(token, { secure: isSecureRequest(c.req.url) }));
  const dest = user.role === "speaker" ? "/portal" : "/admin";
  return c.redirect(dest, 302);
});

authRoutes.post("/logout", csrfFormOrHeader, async (c) => {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const token = cookies[SESSION_COOKIE_NAME];
  if (token) {
    const tokenHash = await hashToken(token);
    await c.var.db.delete(schema.authSession).where(eq(schema.authSession.tokenHash, tokenHash));
  }
  c.header("Set-Cookie", clearSessionCookie());
  return c.redirect("/login", 302);
});

authRoutes.get("/claim/:token", async (c) => {
  const token = c.req.param("token");
  const kv = c.env.KV as unknown as KVStore;
  const record = await readClaimToken(kv, token);
  if (!record) {
    return c.text("This link is invalid or has expired.", 410);
  }
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<ClaimPage csrfToken={csrfToken} />);
});

authRoutes.post("/claim/:token", csrfForm, async (c) => {
  const token = c.req.param("token");
  const kv = c.env.KV as unknown as KVStore;
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const limit = await checkAndIncrementScopedLimit(kv, "claim", ip, Date.now(), {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });
  if (!limit.ok) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<ClaimPage csrfToken={csrfToken} error={RATE_LIMIT_ERROR} />, 429);
  }

  // DEC-064: peek the record without consuming it. Any validation failure
  // below (short password, duplicate user) must leave the one-time link
  // claimable — only consume it right before the user insert.
  const record = await readClaimToken(kv, token);
  if (!record) {
    throw new ApiError("not_found", "This link is invalid or has expired.");
  }

  const body = await c.req.parseBody();
  const password = String(body.password ?? "");
  if (password.length < 8) {
    throw new ApiError("invalid", "Password must be at least 8 characters.", {
      password: "Too short",
    });
  }

  const db = c.var.db;
  const contactRows = await db
    .select()
    .from(schema.contact)
    .where(eq(schema.contact.id, record.contactId))
    .limit(1);
  const contact = contactRows[0];
  if (!contact) {
    throw new ApiError("not_found", "Contact not found for this claim link.");
  }

  // DEC-014/DEC-456: if a user already exists for this contact (by
  // contact_id OR email — a contact's email can drift out of sync with its
  // linked user row), don't create a duplicate — send them to /login
  // instead. The token stays unconsumed.
  const existingUserId = await findAccountUserId(db, { contactId: contact.id, email: contact.email });
  if (existingUserId) {
    return c.redirect("/login", 302);
  }

  // Consume immediately before the insert. If another concurrent request
  // already consumed it (lost race), treat this like an expired link.
  const consumed = await consumeClaimToken(kv, token);
  if (!consumed) {
    throw new ApiError("not_found", "This link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const userId = newId();
  await db.insert(schema.user).values({
    id: userId,
    orgId: contact.orgId,
    email: contact.email.toLowerCase(),
    passwordHash,
    role: "speaker",
    contactId: contact.id,
    createdAt: now,
    updatedAt: now,
  });

  const sessionToken = newSessionToken();
  const tokenHash = await hashToken(sessionToken);
  await db.insert(schema.authSession).values({
    id: newId(),
    userId,
    tokenHash,
    expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
    createdAt: now,
    updatedAt: now,
  });

  c.header("Set-Cookie", buildSessionCookie(sessionToken, { secure: isSecureRequest(c.req.url) }));
  return c.redirect("/portal", 302);
});
