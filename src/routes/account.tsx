// Self-service password change (DEC-200): a speaker/reviewer/organizer with
// a live session can rotate their own password without organizer help.
// Route file exports a named Hono sub-app; only src/index.ts mounts it
// (DEC-012/013). sessionLoader is global (src/server/app.ts), so
// c.var.auth is already populated here with no extra wiring.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { csrfForm } from "../server/middleware";
import * as schema from "../db/schema";
import { newId } from "../domain/ids";
import { hashPassword, verifyPassword } from "../auth/password";
import { newSessionToken, hashToken } from "../auth/tokens";
import {
  buildSessionCookie,
  parseCookies,
  newCsrfToken,
  CSRF_COOKIE_NAME,
} from "../auth/cookies";

export const accountRoutes = new Hono<AppEnv>();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === "https:";
}

// Duplicated in src/routes/auth.tsx and src/routes/portal/profile.tsx —
// house convention is a small per-route-file copy rather than a shared
// helper, per those files' precedent.
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

function PasswordPage(props: { csrfToken: string; error?: string; success?: boolean }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Change password - Chautauqua</title>
      </head>
      <body>
        <h1>Change password</h1>
        {props.error ? <p role="alert">{props.error}</p> : null}
        {props.success ? (
          <p role="status">Password changed. Every other signed-in session has been signed out.</p>
        ) : null}
        <form method="post" action="/account/password">
          <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
          <label>
            Current password
            <input type="password" name="current" required />
          </label>
          <label>
            New password
            <input type="password" name="next" minlength={8} required />
          </label>
          <label>
            Confirm new password
            <input type="password" name="confirm" minlength={8} required />
          </label>
          <button type="submit">Change password</button>
        </form>
      </body>
    </html>
  );
}

accountRoutes.get("/account/password", (c) => {
  if (!c.var.auth) return c.redirect("/login", 302);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<PasswordPage csrfToken={csrfToken} />);
});

/** Runs ahead of csrfForm so an anonymous POST redirects to /login instead
 * of failing CSRF validation first (an anonymous request never carries the
 * double-submit cookie, and a 400 there would be a confusing dead end). */
const requireAuthOr302: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.auth) {
    return c.redirect("/login", 302);
  }
  await next();
};

accountRoutes.post("/account/password", requireAuthOr302, csrfForm, async (c) => {
  const auth = c.var.auth!;
  const db = c.var.db;
  const body = await c.req.parseBody();
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  const confirm = String(body.confirm ?? "");

  const rows = await db.select().from(schema.user).where(eq(schema.user.id, auth.userId)).limit(1);
  const user = rows[0];
  if (!user) {
    // Fail loudly: a live session with no backing user row is data
    // corruption, not a recoverable 404.
    throw new Error(`No user row for authenticated userId '${auth.userId}'`);
  }

  if (!(await verifyPassword(current, user.passwordHash))) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<PasswordPage csrfToken={csrfToken} error="Current password is incorrect." />, 400);
  }

  if (next.length < 8) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <PasswordPage csrfToken={csrfToken} error="New password must be at least 8 characters." />,
      400,
    );
  }
  if (next !== confirm) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <PasswordPage csrfToken={csrfToken} error="New password and confirmation do not match." />,
      400,
    );
  }

  const passwordHash = await hashPassword(next);
  const now = new Date();
  await db.update(schema.user).set({ passwordHash, updatedAt: now }).where(eq(schema.user.id, auth.userId));

  // DEC-200: revoke every existing session for this user (including the one
  // that made this request) — then immediately issue a fresh one for the
  // current browser. Net effect: this browser stays signed in, every other
  // device/browser is signed out.
  await db.delete(schema.authSession).where(eq(schema.authSession.userId, auth.userId));

  const token = newSessionToken();
  const tokenHash = await hashToken(token);
  await db.insert(schema.authSession).values({
    id: newId(),
    userId: auth.userId,
    tokenHash,
    expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
    createdAt: now,
    updatedAt: now,
  });

  c.header("Set-Cookie", buildSessionCookie(token, { secure: isSecureRequest(c.req.url) }));
  const { token: csrfToken } = ensureCsrfCookie(c);
  return c.html(<PasswordPage csrfToken={csrfToken} success />);
});
