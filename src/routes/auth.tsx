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
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "../auth/password";
import { hashToken } from "../auth/tokens";
import { issueSession, issueSessionRevokingAll } from "../server/auth-session";
import { DEC_994, DEC_949, DEC_004 } from "../decisions";

void DEC_994;
void DEC_949;
void DEC_004;
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
import { createResetToken, readResetToken, consumeResetToken, hashResetToken, newResetToken } from "../auth/password-reset";
import { findAccountUserId } from "../server/repo/comms";
import { requestIpFromHeaders } from "../lib/rate-limit";
import {
  checkAndIncrementScopedLimit,
  peekScopedLimit,
  incrementScopedLimit,
  resetScopedLimit,
} from "../server/repo/rate-limit";
import { ThemeStyles } from "../views/theme";
import { AUTH_CSS } from "./auth.css";
import { DEMO_IDENTITIES, type DemoIdentity } from "../lib/demo-identities";
import { demoIdentitiesPresent } from "../server/repo/demo";
import { getHubOrg, listHubEvents } from "../server/repo/public/home";
import { listEventsForOrg } from "../server/repo/events";
import { makeMailer } from "../server/context";
import { resolveBaseUrl } from "../server/origin";
import { renderTemplate } from "../mail/render";
import { renderEmailHtml } from "../mail/shell";
import { DEC_583, DEC_740, DEC_014, DEC_154, DEC_180 } from "../decisions";

void DEC_583;
void DEC_740;
void DEC_014;
void DEC_154;
void DEC_180;

// DEC-740: the sign-in card names the deployment's single event when there
// is exactly one, and offers both public doors -- reusing the SAME
// getHubOrg/listHubEvents primitives the home hub (src/routes/root.tsx)
// binds, rather than a second reader of cfpOpen/publishedSessionCount.
export const MIN_PASSWORD_LENGTH = 12;

interface LoginFooterEvent {
  name: string;
  slug: string;
  cfpOpen: boolean;
  hasPublished: boolean;
}

/** Resolves the deployment's single event (name/slug/window state) for the
 * login card's subtitle + footer -- null when there isn't exactly one
 * event, in which case the subtitle stays generic and the footer renders
 * nothing (no single event to link to). */
async function loadSingleEventContext(db: import("../server/context").Db): Promise<LoginFooterEvent | null> {
  const org = await getHubOrg(db);
  if (!org) return null;
  const page = await listHubEvents(db, org.id, Date.now());
  if (page.items.length !== 1) return null;
  const event = page.items[0];
  if (!event) return null;
  return {
    name: event.name,
    slug: event.slug,
    cfpOpen: event.cfpOpen,
    hasPublished: event.publishedSessionCount > 0,
  };
}

// DEC-583: prefill-only, never auto-submitted. One event-delegated click
// handler reads data-demo-email/data-demo-password off whichever
// .chq-auth-demo-btn was clicked and writes them into the visible
// email/password inputs -- no auto-login, no new endpoint, no POST. This
// script string is a fixed, value-free constant (never interpolated with
// request/user/identity data -- those live in data- attributes on the
// buttons themselves, escaped normally by hono/jsx).
const DEMO_PREFILL_SCRIPT = `
document.addEventListener('click', function (e) {
  var target = e.target;
  var btn = target && target.closest ? target.closest('.chq-auth-demo-btn') : null;
  if (!btn) return;
  var email = btn.getAttribute('data-demo-email');
  var password = btn.getAttribute('data-demo-password');
  var emailInput = document.querySelector('input[name="email"]');
  var passwordInput = document.querySelector('input[name="password"]');
  if (emailInput && email !== null) emailInput.value = email;
  if (passwordInput && password !== null) passwordInput.value = password;
});
`;

export const AUTH_RATE_LIMIT_WINDOW_SECONDS = 900;
export const AUTH_RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_ERROR = "Too many attempts. Try again in a few minutes.";

export const authRoutes = new Hono<AppEnv>();

// DEC-583: the demo-prefill block renders if and only if every DEMO_IDENTITIES
// email has a real user row in this database -- true on the seeded demo
// deployment, false (and therefore rendering NOTHING -- no emails, no
// passwords, anywhere in the HTML) on any real deployment.
async function loadDemoIdentitiesIfPresent(db: import("../server/context").Db): Promise<DemoIdentity[]> {
  const present = await demoIdentitiesPresent(
    db,
    DEMO_IDENTITIES.map((i) => i.email),
  );
  return present ? [...DEMO_IDENTITIES] : [];
}

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

/** DEC-154 (wave 25 amendment): keyed on the query string, this is the ONE
 * owner of the login card's muted status line -- /logout's ?signed-out=1
 * today, the password-reset states share this exact function rather than
 * inventing a second status mechanism. Returns null when the URL carries no
 * recognized status. */
export function loginStatusLine(url: string): string | null {
  const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  const params = new URLSearchParams(query);
  if (params.get("signed-out") === "1") return "You have been signed out.";
  // POST /reset/:token redirects here with ?password-reset=1 on success --
  // DEC-994 (wave-27 amendment) revokes every session on a completed reset,
  // so the user signs back in by hand rather than being carried straight
  // into the dashboard.
  if (params.get("password-reset") === "1") return "Your password has been changed. Sign in with it.";
  return null;
}

function LoginPage(props: {
  csrfToken: string;
  error?: string;
  email?: string;
  demoIdentities?: readonly DemoIdentity[];
  singleEvent?: LoginFooterEvent | null;
  statusLine?: string | null;
}) {
  const demoIdentities = props.demoIdentities ?? [];
  const singleEvent = props.singleEvent ?? null;
  const subtitle = singleEvent ? `Sign in to ${singleEvent.name}` : "Sign in to your account";
  const showSubmit = singleEvent !== null && singleEvent.cfpOpen;
  const showBrowse = singleEvent !== null && singleEvent.hasPublished;
  return (
    <html lang="en">
      <AuthHead title="Log in - Chautauqua" />
      <body>
        <main className="chq-auth-card">
          <div>
            <h1 className="chq-auth-wordmark">chautauqua</h1>
            <div className="chq-auth-subtitle">{subtitle}</div>
          </div>
          {props.statusLine ? <p className="chq-auth-status">{props.statusLine}</p> : null}
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
              <input
                className="chq-input"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={props.email ?? undefined}
                required
                autofocus
              />
            </label>
            <label>
              <span className="chq-auth-label">Password</span>
              <input className="chq-input" type="password" name="password" required />
            </label>
            <div className="chq-auth-submitrow">
              <a className="chq-auth-tertiary" href="/forgot">
                Forgot your password?
              </a>
              <button type="submit" id="chq-login-submit" className="chq-btn-primary">
                Sign in
              </button>
            </div>
          </form>
          {showSubmit || showBrowse ? (
            <div className="chq-auth-footer">
              <span className="chq-auth-label">No account?</span>
              <div className="chq-auth-footer-links">
                {showSubmit ? (
                  <a href={`/submit/${singleEvent!.slug}`}>Submit a talk &rsaquo;</a>
                ) : null}
                {showBrowse ? (
                  <a href={`/e/${singleEvent!.slug}/sessions`}>Browse the sessions &rsaquo;</a>
                ) : null}
              </div>
            </div>
          ) : null}
          {demoIdentities.length > 0 ? (
            <div className="chq-auth-demo">
              <div className="chq-auth-demo-label">Try it with a seeded demo account</div>
              <div className="chq-auth-demo-buttons">
                {demoIdentities.map((identity) => (
                  <button
                    type="button"
                    className="chq-auth-demo-btn"
                    data-demo-email={identity.email}
                    data-demo-password={identity.password}
                  >
                    {identity.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </main>
        {demoIdentities.length > 0 ? <script dangerouslySetInnerHTML={{ __html: DEMO_PREFILL_SCRIPT }} /> : null}
      </body>
    </html>
  );
}

function ClaimPage(props: { csrfToken: string; error?: string }) {
  return (
    <html lang="en">
      <AuthHead title="Create your password - Chautauqua" />
      <body>
        <main className="chq-auth-card">
          <div>
            <h1 className="chq-auth-wordmark">chautauqua</h1>
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
              <input className="chq-input" type="password" name="password" minlength={MIN_PASSWORD_LENGTH} required />
            </label>
            <div className="chq-auth-submitrow">
              <button type="submit" className="chq-btn-primary">
                Create password
              </button>
            </div>
          </form>
        </main>
      </body>
    </html>
  );
}

function ExpiredClaimPage() {
  return (
    <html lang="en">
      <AuthHead title="Link expired - Chautauqua" />
      <body>
        <main className="chq-auth-card chq-auth-card-narrow">
          <div className="chq-auth-titlerow">
            <span className="chq-auth-label">Link expired</span>
            <h1 className="chq-auth-title">This link has expired</h1>
          </div>
          <p className="chq-auth-body">
            Ask the organizer to send you a new portal invite. If you already set a password, you can sign in directly.
          </p>
          <div className="chq-auth-footer-links">
            <a href="/login">Log in &rsaquo;</a>
          </div>
        </main>
      </body>
    </html>
  );
}

// -----------------------------------------------------------------------
// Password reset (DEC-014 wave-25 amendment, DEC-154, DEC-180, DEC-994).
// Frame-exact copy from docs/design/Chautauqua Account.dc.html:186-285
// ("Reset · ask for a link" / "Reset · link sent" / "Reset · choose a new
// one" / "Reset · link no longer valid").
// -----------------------------------------------------------------------

function ForgotPasswordPage(props: { csrfToken: string; email?: string; error?: string }) {
  return (
    <html lang="en">
      <AuthHead title="Reset your password - Chautauqua" />
      <body>
        <main className="chq-auth-card">
          <div>
            <h1 className="chq-auth-title">Reset your password</h1>
            <div className="chq-auth-subtitle">We will email you a link to set a new one.</div>
          </div>
          {props.error ? (
            <p className="chq-auth-error" role="alert">
              {props.error}
            </p>
          ) : null}
          <form className="chq-auth-fields" method="post" action="/forgot">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <label>
              <span className="chq-auth-label">Email</span>
              <input
                className="chq-input"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={props.email ?? undefined}
                required
                autofocus
              />
            </label>
            <div className="chq-auth-submitrow">
              <a className="chq-auth-tertiary" href="/login">
                &lsaquo; Back to sign in
              </a>
              <button type="submit" className="chq-btn-primary">
                Email me a link
              </button>
            </div>
          </form>
        </main>
      </body>
    </html>
  );
}

// DEC-004 (wave-27 amendment): this copy names no address and no account
// state -- rendered for a known and an unknown email alike, with nothing in
// the markup that differs between the two, so the page can never be used as
// an account-enumeration oracle.
function CheckEmailPage() {
  return (
    <html lang="en">
      <AuthHead title="Check your email - Chautauqua" />
      <body>
        <main className="chq-auth-card">
          <div>
            <h1 className="chq-auth-title">Check your email</h1>
            <div className="chq-auth-subtitle">
              If that address has an account, a reset link is on its way.
            </div>
          </div>
          <div className="chq-auth-footer">
            <span className="chq-auth-hint">Nothing arrived? Check spam, then try again.</span>
          </div>
          <div className="chq-auth-submitrow">
            <a className="chq-auth-tertiary" href="/forgot">
              Use a different address
            </a>
            <a className="chq-btn chq-btn-primary" href="/login">
              Back to sign in
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

function ResetPasswordPage(props: { csrfToken: string; email: string; error?: string }) {
  return (
    <html lang="en">
      <AuthHead title="Choose a new password - Chautauqua" />
      <body>
        <main className="chq-auth-card">
          <div>
            <h1 className="chq-auth-title">Choose a new password</h1>
            <div className="chq-auth-subtitle">Signing in as {props.email}.</div>
          </div>
          {props.error ? (
            <p className="chq-auth-error" role="alert">
              {props.error}
            </p>
          ) : null}
          <form className="chq-auth-fields" method="post">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <label>
              <span className="chq-auth-label">New password</span>
              <input
                className="chq-input"
                type="password"
                name="next"
                minlength={MIN_PASSWORD_LENGTH}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                required
              />
              <span className="chq-auth-hint">A passphrase of three or four words beats a short scramble</span>
            </label>
            <label>
              <span className="chq-auth-label">New password again</span>
              <input className="chq-input" type="password" name="confirm" minlength={MIN_PASSWORD_LENGTH} required />
            </label>
            <div className="chq-auth-submitrow">
              <button type="submit" className="chq-btn-primary">
                Save and sign in
              </button>
            </div>
          </form>
        </main>
      </body>
    </html>
  );
}

function ExpiredResetPage() {
  return (
    <html lang="en">
      <AuthHead title="Link expired - Chautauqua" />
      <body>
        <main className="chq-auth-card">
          <div>
            <h1 className="chq-auth-title">That link has expired</h1>
            <div className="chq-auth-subtitle">
              This link has already been used, or it has been replaced by a newer one.
            </div>
          </div>
          <div className="chq-auth-submitrow">
            <a className="chq-auth-tertiary" href="/login">
              &lsaquo; Back to sign in
            </a>
            <a className="chq-btn chq-btn-primary" href="/forgot">
              Send a fresh link
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

// DEC-014 (wave-25 amendment): the reset email's plain-text body, rendered
// through renderTemplate (src/mail/render.ts) like every other outbound
// email; the HTML body is the SAME text run through the shared B9 shell
// (src/mail/shell.ts renderEmailHtml, DEC-037 wave-27 amendment) rather
// than a bespoke wrapper -- never a bare textToHtml call
// (test/email-shell-sweep.scan.test.ts enforces this repo-wide).
// `eventName` is the deployment's single event when resolvable (DEC-740's
// loadSingleEventContext), else a generic "your Chautauqua account" footer
// line -- there is no other candidate name to attribute the send to.
const RESET_EMAIL_TEMPLATE = `Set a new password

Use this link to choose a new password. It expires in one hour and works once:
{reset_link}

{reason_line} If you did not request this, you can ignore this email.
`;

function resetEmailText(opts: { resetUrl: string; eventName: string | null }): string {
  const reasonLine = opts.eventName
    ? `You're receiving this because you have an account for ${opts.eventName}.`
    : "You're receiving this because you have a Chautauqua account.";
  return renderTemplate(RESET_EMAIL_TEMPLATE, { reset_link: opts.resetUrl, reason_line: reasonLine });
}

authRoutes.get("/login", async (c) => {
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

authRoutes.post("/login", csrfForm, async (c) => {
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
  // DEC-180: the counters only advance on FAILED attempts — a successful
  // login must not consume the shared budget, so we peek (read-only) before
  // verifying the password, and only increment after a failure is
  // confirmed. On success the per-email budget is cleared entirely.
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const loginNow = Date.now();
  const userPeek = await peekScopedLimit(db, "login-user", email, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });
  const ipPeek = await peekScopedLimit(db, "login-ip", ip, loginNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: 100,
  });

  if (!userPeek.ok || !ipPeek.ok) {
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
    await incrementScopedLimit(db, "login-user", email, loginNow, {
      windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: AUTH_RATE_LIMIT_MAX,
    });
    await incrementScopedLimit(db, "login-ip", ip, loginNow, {
      windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: 100,
    });
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
// one place that status is read (loginStatusLine above).
authRoutes.get("/logout", async (c) => {
  return c.redirect("/login", 302);
});

authRoutes.post("/logout", csrfFormOrHeader, async (c) => {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const token = cookies[SESSION_COOKIE_NAME];
  if (token) {
    const tokenHash = await hashToken(token);
    await c.var.db.delete(schema.authSession).where(eq(schema.authSession.tokenHash, tokenHash));
  }
  c.header("Set-Cookie", clearSessionCookie());
  return c.redirect("/login?signed-out=1", 302);
});

authRoutes.get("/claim/:token", async (c) => {
  const token = c.req.param("token");
  const kv = c.env.KV as unknown as KVStore;
  const record = await readClaimToken(kv, token);
  if (!record) {
    return c.html(<ExpiredClaimPage />, 410);
  }
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<ClaimPage csrfToken={csrfToken} />);
});

authRoutes.post("/claim/:token", csrfForm, async (c) => {
  const token = c.req.param("token");
  const kv = c.env.KV as unknown as KVStore;
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const limit = await checkAndIncrementScopedLimit(c.var.db, "claim", ip, Date.now(), {
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
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError("invalid", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, {
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

  const sessionToken = await issueSessionRevokingAll(db, userId, now);

  c.header("Set-Cookie", buildSessionCookie(sessionToken, { secure: isSecureRequest(c.req.url) }));
  return c.redirect("/portal", 302);
});

// -----------------------------------------------------------------------
// Password reset (DEC-014 wave-25 amendment / DEC-154 / DEC-180 / DEC-994).
// -----------------------------------------------------------------------

authRoutes.get("/forgot", async (c) => {
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<ForgotPasswordPage csrfToken={csrfToken} />);
});

authRoutes.post("/forgot", csrfForm, async (c) => {
  const db = c.var.db;
  const body = await c.req.parseBody();
  const submittedEmail = String(body.email ?? "").trim();
  const normalizedEmail = submittedEmail.toLowerCase();
  const now = Date.now();

  // DEC-004 (wave-27 amendment): there is no "failure" this handler can
  // condition on without itself leaking account existence, so the budget
  // is a single atomic check-and-increment (DEC-948) against the SUBMITTED
  // email, run on every request regardless of outcome -- never a
  // peek-then-conditionally-mutate shape (that would still branch on the
  // rate-limit counter, but never on whether the account exists). A 429
  // here fires purely off request volume against one address, known or
  // not, so it doesn't leak existence either.
  const limit = await checkAndIncrementScopedLimit(db, "password-reset", normalizedEmail, now, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });
  if (!limit.ok) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<ForgotPasswordPage csrfToken={csrfToken} email={submittedEmail} error={RATE_LIMIT_ERROR} />, 429);
  }

  // DEC-014 (wave-25 amendment) / DEC-004 (wave-27 amendment): everything
  // below this line is a server-side side effect (KV writes, a
  // best-effort email send) that must NEVER change the response — the
  // exact same <CheckEmailPage> is returned at the bottom of this handler
  // regardless of which branch below runs.
  const rows = await db.select().from(schema.user).where(eq(schema.user.email, normalizedEmail)).limit(1);
  const user = rows[0];

  if (user) {
    const kv = c.env.KV as unknown as KVStore;
    const resetToken = await createResetToken(kv, user.id);
    const origin = resolveBaseUrl(c);
    const resetUrl = `${origin}/reset/${resetToken}`;

    // email_log.event_id is NOT NULL (DEC-006); a password reset isn't
    // event-scoped, so — mirroring POST /api/v1/users' welcome-email
    // anchoring (src/routes/api/users.ts) — the send is logged against
    // the org's first event when one exists. An org with zero events
    // still mints and stores the token (the on-screen response is
    // identical either way) but has no event to log the send against, so
    // sending is skipped. No design doc covers this gap; narrowest
    // reading, flagged for the scribe.
    const orgEvents = await listEventsForOrg(db, user.orgId);
    const anchorEvent = orgEvents[0];
    if (anchorEvent) {
      try {
        const mailer = makeMailer(db, c.env);
        const text = resetEmailText({ resetUrl, eventName: anchorEvent.name });
        const html = renderEmailHtml(text, {
          eventName: anchorEvent.name,
          reason: "you requested a password reset for your account.",
          cta: { label: "Set a new password", href: resetUrl },
        });
        await mailer.send({
          to: { email: user.email, name: user.email },
          subject: "Set a new password",
          text,
          html,
          eventId: anchorEvent.id,
          contactId: user.contactId ?? null,
        });
      } catch (err) {
        console.error("password reset email failed (token still minted):", err);
      }
    }
  } else {
    // No account: burn a comparable SHA-256 cost to the mint path above
    // (DEC-004-style — never short-circuit past the work a real branch
    // would do). The rate-limit budget above already counted this request
    // regardless of outcome (checkAndIncrementScopedLimit), so there is no
    // separate counter to advance here.
    await hashResetToken(newResetToken());
  }

  return c.html(<CheckEmailPage />);
});

authRoutes.get("/reset/:token", async (c) => {
  const token = c.req.param("token");
  const kv = c.env.KV as unknown as KVStore;
  const record = await readResetToken(kv, token);
  if (!record) {
    return c.html(<ExpiredResetPage />, 410);
  }

  const db = c.var.db;
  const rows = await db.select().from(schema.user).where(eq(schema.user.id, record.userId)).limit(1);
  const user = rows[0];
  if (!user) {
    // A live reset grant with no backing user row is data corruption
    // (the account was deleted after the token was minted), not a
    // recoverable 404 — fail loudly.
    throw new Error(`No user row for reset token userId '${record.userId}'`);
  }

  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<ResetPasswordPage csrfToken={csrfToken} email={user.email} />);
});

authRoutes.post("/reset/:token", csrfForm, async (c) => {
  const token = c.req.param("token");
  const kv = c.env.KV as unknown as KVStore;

  // Consume FIRST, before any validation — a replayed POST against an
  // already-used (or never-valid) token always lands on the 410 card,
  // rather than re-running the change or leaking whether it was ever
  // valid.
  const consumed = await consumeResetToken(kv, token);
  if (!consumed) {
    return c.html(<ExpiredResetPage />, 410);
  }

  const db = c.var.db;
  const rows = await db.select().from(schema.user).where(eq(schema.user.id, consumed.userId)).limit(1);
  const user = rows[0];
  if (!user) {
    throw new Error(`No user row for reset token userId '${consumed.userId}'`);
  }

  const body = await c.req.parseBody();
  const next = String(body.next ?? "");
  const confirm = String(body.confirm ?? "");

  if (next.length < MIN_PASSWORD_LENGTH) {
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
    return c.html(
      <ResetPasswordPage
        csrfToken={csrfToken}
        email={user.email}
        error={`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`}
      />,
      400,
    );
  }
  if (next !== confirm) {
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
    return c.html(
      <ResetPasswordPage csrfToken={csrfToken} email={user.email} error="New password and confirmation do not match." />,
      400,
    );
  }

  const passwordHash = await hashPassword(next);
  const now = new Date();
  await db.update(schema.user).set({ passwordHash, updatedAt: now }).where(eq(schema.user.id, user.id));

  // DEC-994 (wave-27 amendment): a reset asserts the credential was LOST —
  // the opposite of login's rotate-this-session-only rule — so every
  // existing session for this user is revoked. Unlike POST /account/password
  // and POST /claim/:token (both reached from an already-authenticated
  // browser, or one that just proved control of an inbox mid-session), this
  // request came from an anonymous browser that only proved control of an
  // inbox; it does not carry the user back in on the new grant
  // issueSessionRevokingAll mints — it discards that token and sends them to
  // /login to sign in with the password they just set, where the status
  // line names what happened.
  await issueSessionRevokingAll(db, user.id, now);

  return c.redirect("/login?password-reset=1", 302);
});
