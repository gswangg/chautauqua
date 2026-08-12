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
  buildCsrfCookie,
  parseCookies,
  newCsrfToken,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../auth/cookies";
import { ThemeStyles } from "../views/theme";

export const accountRoutes = new Hono<AppEnv>();

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

// DEC-367/371: self-service password change re-skinned to the "Change
// password · /account/password" panel from docs/design/Chautauqua
// Account.dc.html — paper card, uppercase field labels, one filled
// primary + a plain-type "you stay signed in" note, error/status text as
// type not a colored banner (no red anywhere).
const ACCOUNT_CARD_STYLE = `
  body { display: flex; justify-content: center; padding: 40px 20px; }
  .chq-account-card {
    width: 100%;
    max-width: 520px;
    background: var(--chq-paper);
    border: 1px solid var(--chq-rule);
    border-radius: 6px;
    padding: 32px 34px 30px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .chq-account-back { font-size: 13px; font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; }
  .chq-account-title {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    font-size: 27px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--chq-ink);
  }
  .chq-account-fields { display: flex; flex-direction: column; gap: 14px; }
  .chq-account-label {
    display: block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--chq-muted);
    margin-bottom: 6px;
  }
  .chq-account-card input[type=password] { display: block; width: 100%; min-height: 48px; }
  .chq-account-message { font-size: 14px; font-weight: 700; color: var(--chq-ink); }
  .chq-account-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    border-top: 1px solid var(--chq-rule);
    padding-top: 18px;
  }
  .chq-account-actions button[type=submit] { padding: 0 20px; }
  .chq-account-hint { font-size: 13px; color: var(--chq-muted); }
  @media (max-width: 480px) {
    body { padding: 0; }
    .chq-account-card { max-width: none; border: none; border-radius: 0; padding: 28px 16px 20px; }
  }
`;

function PasswordPage(props: { csrfToken: string; error?: string; success?: boolean }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Change password - Chautauqua</title>
        <ThemeStyles />
        <style>{ACCOUNT_CARD_STYLE}</style>
      </head>
      <body>
        <div className="chq-account-card">
          <div>
            <a className="chq-account-back" href="/admin">
              &lsaquo; Back
            </a>
            <div className="chq-account-title">Change your password</div>
          </div>
          {props.error ? (
            <p className="chq-account-message" role="alert">
              {props.error}
            </p>
          ) : null}
          {props.success ? (
            <p className="chq-account-message" role="status">
              Password changed. Every other signed-in session has been signed out.
            </p>
          ) : null}
          <form className="chq-account-fields" method="post" action="/account/password">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <label>
              <span className="chq-account-label">Current password</span>
              <input type="password" name="current" required />
            </label>
            <label>
              <span className="chq-account-label">New password</span>
              <input type="password" name="next" minlength={8} required />
            </label>
            <label>
              <span className="chq-account-label">Confirm new password</span>
              <input type="password" name="confirm" minlength={8} required />
            </label>
            <div className="chq-account-actions">
              <button type="submit" className="chq-btn-primary">
                Change it
              </button>
              <span className="chq-account-hint">You stay signed in on this device</span>
            </div>
          </form>
        </div>
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
