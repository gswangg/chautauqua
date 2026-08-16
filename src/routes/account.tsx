// Self-service password change (DEC-200): a speaker/reviewer/organizer with
// a live session can rotate their own password without organizer help.
// Route file exports a named Hono sub-app; only src/index.ts mounts it
// (DEC-012/013). sessionLoader is global (src/server/app.ts), so
// c.var.auth is already populated here with no extra wiring.

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { csrfForm, requireCookieSession } from "../server/middleware";
import * as schema from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  buildSessionCookie,
  buildCsrfCookie,
  parseCookies,
  newCsrfToken,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../auth/cookies";
import { issueSessionRevokingAll } from "../server/auth-session";
import { ThemeStyles } from "../views/theme";
import { AUTH_CSS } from "./auth.css";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, AUTH_RATE_LIMIT_WINDOW_SECONDS, AUTH_RATE_LIMIT_MAX, RATE_LIMIT_ERROR } from "./auth";
import { checkAndIncrementScopedLimit, resetScopedLimit } from "../server/repo/rate-limit";
import { revokeResetTokenForUser, type KVStore } from "../auth/password-reset";
import { DEC_740, DEC_994, DEC_180, DEC_949 } from "../decisions";

void DEC_180;

void DEC_740;
void DEC_994;
void DEC_949;

export const accountRoutes = new Hono<AppEnv>();

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

// DEC-367/371/373/374: self-service password change re-skinned to the
// "Change password · /account/password" panel from docs/design/
// Chautauqua Account.dc.html — paper card, uppercase field labels, one
// filled primary + a plain-type "you stay signed in" note, error/status
// text as type not a colored banner (no red anywhere). AUTH_CSS (src/
// routes/auth.css.ts) supplies the shared .chq-auth-* card layout;
// ThemeStyles() supplies tokens/reset. Both injected via
// dangerouslySetInnerHTML, never a JSX text child (DEC-374).
/** DEC-366: /admin is organizer/reviewer turf; a speaker's home is /portal
 * -- hardcoding /admin sent a signed-in speaker to a page their role can't
 * open. */
function backHrefForRole(role: "organizer" | "reviewer" | "speaker"): string {
  return role === "speaker" ? "/portal" : "/admin";
}

// Exported so test/password-length-bound.test.ts can render it directly to
// assert the maxlength bound without standing up the whole session/db stack.
export function PasswordPage(props: {
  csrfToken: string;
  backHref: string;
  error?: string;
  success?: boolean;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Change password - Chautauqua</title>
        <ThemeStyles />
        <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
      </head>
      <body>
        <main className="chq-bare-page">
          <div className="chq-auth-titlerow">
            <a className="chq-auth-back" href={props.backHref}>
              &lsaquo; Back
            </a>
            <h1 className="chq-auth-title">Change your password</h1>
          </div>
          {props.error ? (
            <p className="chq-auth-error" role="alert">
              {props.error}
            </p>
          ) : null}
          {props.success ? (
            <p className="chq-auth-error" role="status">
              Password changed. Every other signed-in session has been signed out.
            </p>
          ) : null}
          <form className="chq-auth-fields" method="post" action="/account/password">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <div className="chq-auth-fieldstack">
              <label>
                <span className="chq-auth-label">Current password</span>
                <input className="chq-input" type="password" name="current" required />
              </label>
              <label>
                <span className="chq-auth-label">New password</span>
                <input
                  className="chq-input"
                  type="password"
                  name="next"
                  minlength={MIN_PASSWORD_LENGTH}
                  maxlength={MAX_PASSWORD_LENGTH}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  required
                />
              </label>
              <label>
                <span className="chq-auth-label">New password again</span>
                <input
                  className="chq-input"
                  type="password"
                  name="confirm"
                  minlength={MIN_PASSWORD_LENGTH}
                  maxlength={MAX_PASSWORD_LENGTH}
                  required
                />
              </label>
            </div>
            <div className="chq-auth-actions">
              <button type="submit" className="chq-btn chq-btn-primary">
                Change it
              </button>
              <a
                className="chq-btn chq-btn-secondary chq-auth-cancel"
                href={props.backHref}
              >
                Cancel
              </a>
              <span className="chq-auth-hint">You stay signed in on this device</span>
            </div>
          </form>
        </main>
      </body>
    </html>
  );
}

accountRoutes.get("/account/password", (c) => {
  if (!c.var.auth) return c.redirect("/login", 302);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<PasswordPage csrfToken={csrfToken} backHref={backHrefForRole(c.var.auth.role)} />);
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

accountRoutes.post("/account/password", requireAuthOr302, requireCookieSession, csrfForm, async (c) => {
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

  const backHref = backHrefForRole(auth.role);

  // DEC-948 / DEC-180 (wave-29 amendment): CONSUME THEN REFUND, keyed on the
  // authenticated userId (not email/IP) since this route always has a live
  // session. The budget is checked-and-incremented atomically BEFORE the
  // password derivation runs -- a read-only peek followed by a later
  // increment lets N concurrent requests all read the same pre-increment
  // count and all reach the derivation (the read-then-write race DEC-948
  // forbids). checkAndIncrement is one atomic D1 upsert.
  //
  // DEC-180: a successful change must not consume the budget. Since the
  // spend now happens up front, a confirmed successful verify refunds it by
  // clearing the per-userId bucket immediately below (resetScopedLimit) --
  // mirrors src/routes/auth.tsx's /login limiter shape.
  const rateLimitNow = Date.now();
  const limitCheck = await checkAndIncrementScopedLimit(db, "password-change", auth.userId, rateLimitNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });
  if (!limitCheck.ok) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<PasswordPage csrfToken={csrfToken} backHref={backHref} error={RATE_LIMIT_ERROR} />, 429);
  }

  if (!(await verifyPassword(current, user.passwordHash))) {
    // The budget was already spent at admission above -- no further write
    // on failure.
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<PasswordPage csrfToken={csrfToken} backHref={backHref} error="Current password is incorrect." />, 400);
  }

  // Verify succeeded -- clear the budget now, before the (independent) new-
  // password validation below, so a valid current password never counts
  // toward the failure budget regardless of what happens next.
  await resetScopedLimit(db, "password-change", auth.userId, rateLimitNow, AUTH_RATE_LIMIT_WINDOW_SECONDS);

  if (next.length < MIN_PASSWORD_LENGTH) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <PasswordPage
        csrfToken={csrfToken}
        backHref={backHref}
        error={`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`}
      />,
      400,
    );
  }
  if (next.length > MAX_PASSWORD_LENGTH) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <PasswordPage
        csrfToken={csrfToken}
        backHref={backHref}
        error={`New password must be at most ${MAX_PASSWORD_LENGTH} characters.`}
      />,
      400,
    );
  }
  if (next !== confirm) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <PasswordPage csrfToken={csrfToken} backHref={backHref} error="New password and confirmation do not match." />,
      400,
    );
  }

  // DEC-949 (wave-29 amendment): recovering the credential through ANY path
  // settles the claim a password-reset token asserts, so an outstanding
  // reset grant is revoked FIRST — before the write — so a failed update
  // never leaves a live one-hour takeover link outstanding. Not best-effort:
  // a KV error propagates (fail loudly).
  const kv = c.env.KV as unknown as KVStore;
  await revokeResetTokenForUser(kv, auth.userId);

  const passwordHash = await hashPassword(next);
  const now = new Date();
  await db.update(schema.user).set({ passwordHash, updatedAt: now }).where(eq(schema.user.id, auth.userId));

  // DEC-200/DEC-994: revoke every existing session for this user (including
  // the one that made this request) — then immediately issue a fresh one for
  // the current browser. Net effect: this browser stays signed in, every
  // other device/browser is signed out. issueSessionRevokingAll does the
  // revoke+mint.
  const token = await issueSessionRevokingAll(db, auth.userId, now);

  c.header("Set-Cookie", buildSessionCookie(token, { secure: isSecureRequest(c.req.url) }));
  const { token: csrfToken } = ensureCsrfCookie(c);
  return c.html(<PasswordPage csrfToken={csrfToken} backHref={backHref} success />);
});
