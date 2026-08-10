// Auth routes per DEC-005 (route map) + DEC-012 (SSR login) + DEC-014 (claim
// flow). Route files export a named Hono sub-app; only src/index.ts mounts
// it (DEC-012). Handlers stay thin: parse/authz -> repo query -> response.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { csrfForm } from "../server/middleware";
import { ApiError } from "../server/http";
import * as schema from "../db/schema";
import { newId } from "../domain/ids";
import { hashPassword, verifyPassword } from "../auth/password";
import { newSessionToken, hashToken } from "../auth/tokens";
import {
  buildSessionCookie,
  clearSessionCookie,
  parseCookies,
  newCsrfToken,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../auth/cookies";
import { consumeClaimToken, readClaimToken, type KVStore } from "../auth/claim";
import { checkAndIncrementScopedLimit, requestIpFromHeaders } from "../lib/rate-limit";

const AUTH_RATE_LIMIT_WINDOW_SECONDS = 900;
const AUTH_RATE_LIMIT_MAX = 20;
const RATE_LIMIT_ERROR = "Too many attempts. Try again in a few minutes.";

export const authRoutes = new Hono<AppEnv>();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === "https:";
}

function ensureCsrfCookie(c: { req: { header(name: string): string | undefined } }): {
  token: string;
  setCookieIfNew: string | null;
} {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return { token, setCookieIfNew: `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Lax` };
}

function LoginPage(props: { csrfToken: string; error?: string }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Log in - Chautauqua</title>
      </head>
      <body>
        <h1>Log in</h1>
        {props.error ? <p role="alert">{props.error}</p> : null}
        <form method="post" action="/login">
          <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
          <label>
            Email
            <input type="email" name="email" required autofocus />
          </label>
          <label>
            Password
            <input type="password" name="password" required />
          </label>
          <button type="submit">Log in</button>
        </form>
      </body>
    </html>
  );
}

function ClaimPage(props: { csrfToken: string; error?: string }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Create your password - Chautauqua</title>
      </head>
      <body>
        <h1>Create a password to track your submission</h1>
        {props.error ? <p role="alert">{props.error}</p> : null}
        <form method="post">
          <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
          <label>
            Password
            <input type="password" name="password" minlength={8} required />
          </label>
          <button type="submit">Create password</button>
        </form>
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
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const limit = await checkAndIncrementScopedLimit(kv, "login", ip, Date.now(), {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });
  if (!limit.ok) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<LoginPage csrfToken={csrfToken} error={RATE_LIMIT_ERROR} />, 429);
  }

  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const db = c.var.db;

  const rows = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<LoginPage csrfToken={csrfToken} error="Invalid email or password." />, 401);
  }

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

authRoutes.post("/logout", async (c) => {
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

  const record = await consumeClaimToken(kv, token);
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

  // DEC-014: if a user already exists for this contact's email, don't create
  // a duplicate — send them to /login instead.
  const existingRows = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, contact.email.toLowerCase()))
    .limit(1);
  if (existingRows[0]) {
    return c.redirect("/login", 302);
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
