// Auth SSR page components extracted from src/routes/auth.tsx (contention
// decomposition, no behavior change). Consumed by auth-login.tsx,
// auth-claim.tsx, and auth-reset.tsx.

import { CSRF_COOKIE_NAME } from "../auth/cookies";
import { ThemeStyles } from "../views/theme";
import { AUTH_CSS } from "./auth.css";
import { type DemoIdentity } from "../lib/demo-identities";
import type { LoginFooterEvent, AuthBandCopy } from "./auth-helpers";
import { DEC_583 } from "../decisions";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "../domain/auth-copy";
import { MAX_TEXT_LENGTH } from "../forms/validate";

void DEC_583;

export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH };

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
export function AuthHead(props: { title: string }) {
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

export function LoginPage(props: {
  csrfToken: string;
  error?: AuthBandCopy;
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
        {/* G13 fix (A23 + 11-account frames): the demo block sits BELOW the
            sign-in card, outside it -- the stack wrapper keeps card + demo
            centred as one unit. */}
        <div className="chq-auth-stack">
        <main className="chq-auth-card">
          <div>
            <h1 className="chq-auth-wordmark">chautauqua</h1>
            <div className="chq-auth-subtitle">{subtitle}</div>
          </div>
          {props.statusLine ? <p className="chq-auth-status">{props.statusLine}</p> : null}
          {props.error ? (
            <div className="chq-error-summary" role="alert">
              <h2>{props.error.headline}</h2>
              {props.error.detail ? <p>{props.error.detail}</p> : null}
            </div>
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
                className={props.error ? "chq-input chq-field-invalid" : "chq-input"}
                type="email"
                name="email"
                placeholder="you@example.com"
                value={props.email ?? undefined}
                maxLength={MAX_TEXT_LENGTH}
                required
                autofocus
              />
            </label>
            <label>
              <span className="chq-auth-label">Password</span>
              <input
                className={props.error ? "chq-input chq-field-invalid" : "chq-input"}
                type="password"
                name="password"
                required
              />
            </label>
            <div className="chq-auth-submitrow">
              <a className="chq-auth-tertiary" href="/forgot">
                Forgot your password?
              </a>
              <button type="submit" id="chq-login-submit" className="chq-btn chq-btn-primary">
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
        </main>
        {/* DESIGN-RULINGS A23: below the sign-in card, OUTSIDE it, under a
            DEMO ACCOUNTS micro-label -- three tertiary rows (role · email)
            and a muted line saying passwords come from the seed. */}
        {demoIdentities.length > 0 ? (
          <aside className="chq-auth-demo" aria-label="Demo accounts">
            <div className="chq-auth-demo-label">Demo accounts</div>
            <div className="chq-auth-demo-buttons">
              {demoIdentities.map((identity) => (
                <button
                  type="button"
                  className="chq-auth-demo-btn"
                  data-demo-email={identity.email}
                  data-demo-password={identity.password}
                >
                  {identity.role.charAt(0).toUpperCase() + identity.role.slice(1)} &middot; {identity.email}
                </button>
              ))}
            </div>
            <p className="chq-auth-demo-note">Passwords come from the seed data.</p>
          </aside>
        ) : null}
        </div>
        {demoIdentities.length > 0 ? <script dangerouslySetInnerHTML={{ __html: DEMO_PREFILL_SCRIPT }} /> : null}
      </body>
    </html>
  );
}

export function ClaimPage(props: { csrfToken: string; error?: string }) {
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
            <div className="chq-error-summary" role="alert">
              <h2>{props.error}</h2>
              <p>Fix the password below, then try again.</p>
            </div>
          ) : null}
          <form className="chq-auth-fields" method="post">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <label>
              <span className="chq-auth-label">Password</span>
              <input
                className={props.error ? "chq-input chq-field-invalid" : "chq-input"}
                type="password"
                name="password"
                minlength={MIN_PASSWORD_LENGTH}
                maxlength={MAX_PASSWORD_LENGTH}
                required
              />
            </label>
            <div className="chq-auth-submitrow">
              <button type="submit" className="chq-btn chq-btn-primary">
                Create password
              </button>
            </div>
          </form>
        </main>
      </body>
    </html>
  );
}

export function ExpiredClaimPage() {
  return (
    <html lang="en">
      <AuthHead title="Link expired - Chautauqua" />
      <body>
        <main className="chq-bare-page">
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
// `background:#F4F1E8; border:1px solid #D3CFC0; border-radius:6px`
// ("Reset · ask for a link" / "Reset · link sent" / "Reset · choose a new
// one" / "Reset · link no longer valid").
// -----------------------------------------------------------------------

export function ForgotPasswordPage(props: { csrfToken: string; email?: string; error?: string }) {
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
            <div className="chq-error-summary" role="alert">
              <h2>{props.error}</h2>
              <p>Try again in a few minutes.</p>
            </div>
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
                maxLength={MAX_TEXT_LENGTH}
                required
                autofocus
              />
            </label>
            <div className="chq-auth-submitrow">
              <a className="chq-auth-tertiary" href="/login">
                &lsaquo; Back to sign in
              </a>
              <button type="submit" className="chq-btn chq-btn-primary">
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
export function CheckEmailPage() {
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

export function ResetPasswordPage(props: { csrfToken: string; email: string; error?: string }) {
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
            <div className="chq-error-summary" role="alert">
              <h2>{props.error}</h2>
              <p>Fix the password fields below, then try again.</p>
            </div>
          ) : null}
          <form className="chq-auth-fields" method="post">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <label>
              <span className="chq-auth-label">New password</span>
              <input
                className={props.error ? "chq-input chq-field-invalid" : "chq-input"}
                type="password"
                name="next"
                minlength={MIN_PASSWORD_LENGTH}
                maxlength={MAX_PASSWORD_LENGTH}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                required
              />
              <span className="chq-auth-hint">A passphrase of three or four words beats a short scramble</span>
            </label>
            <label>
              <span className="chq-auth-label">New password again</span>
              <input
                className={props.error ? "chq-input chq-field-invalid" : "chq-input"}
                type="password"
                name="confirm"
                minlength={MIN_PASSWORD_LENGTH}
                maxlength={MAX_PASSWORD_LENGTH}
                required
              />
            </label>
            <div className="chq-auth-submitrow">
              <button type="submit" className="chq-btn chq-btn-primary">
                Save and sign in
              </button>
            </div>
          </form>
        </main>
      </body>
    </html>
  );
}

export function ExpiredResetPage() {
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
