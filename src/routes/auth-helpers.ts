// Auth route helpers extracted from src/routes/auth.tsx (contention
// decomposition, no behavior change). Shared by auth-login.tsx,
// auth-claim.tsx, and auth-reset.tsx.

import type { Db } from "../server/context";
import { buildCsrfCookie, parseCookies, newCsrfToken, isSecureRequest, CSRF_COOKIE_NAME } from "../auth/cookies";
import { DEMO_IDENTITIES, type DemoIdentity } from "../lib/demo-identities";
import { demoIdentitiesPresent } from "../server/repo/demo";
import { getHubOrg, listHubEvents } from "../server/repo/public/home";
import { renderTemplate } from "../mail/render";
import { DEC_740, DEC_154 } from "../decisions";

void DEC_740;
void DEC_154;

export const AUTH_RATE_LIMIT_WINDOW_SECONDS = 900;
export const AUTH_RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_ERROR = "Too many attempts. Try again in a few minutes.";

// DEC-072 wave-54 amendment: the per-identity login budget is keyed on
// email+IP together, not the bare email -- a bare-email key lets a stranger
// who knows (or guesses) a valid organizer address exhaust that address's
// budget from ANY source and lock the real owner out permanently (no
// unlock path exists). Keying on email|ip means only the ATTACKER'S OWN
// IP gets rate-limited against that email; the victim signing in from
// their own IP is unaffected. This is the ONE place the "login-user"
// scope key is assembled -- every touch of that bucket (admission,
// refund on the per-IP deny path, reset on success) must call this.
export function loginIdentityKey(email: string, ip: string): string {
  return `${email}|${ip}`;
}

export interface LoginFooterEvent {
  name: string;
  slug: string;
  cfpOpen: boolean;
  hasPublished: boolean;
}

// DEC-740: the sign-in card names the deployment's single event when there
// is exactly one, and offers both public doors -- reusing the SAME
// getHubOrg/listHubEvents primitives the home hub (src/routes/root.tsx)
// binds, rather than a second reader of cfpOpen/publishedSessionCount.

/** Resolves the deployment's single event (name/slug/window state) for the
 * login card's subtitle + footer -- null when there isn't exactly one
 * event, in which case the subtitle stays generic and the footer renders
 * nothing (no single event to link to). */
export async function loadSingleEventContext(db: Db): Promise<LoginFooterEvent | null> {
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

// DEC-583: the demo-prefill block renders if and only if every DEMO_IDENTITIES
// email has a real user row in this database -- true on the seeded demo
// deployment, false (and therefore rendering NOTHING -- no emails, no
// passwords, anywhere in the HTML) on any real deployment.
export async function loadDemoIdentitiesIfPresent(db: Db): Promise<DemoIdentity[]> {
  const present = await demoIdentitiesPresent(
    db,
    DEMO_IDENTITIES.map((i) => i.email),
  );
  return present ? [...DEMO_IDENTITIES] : [];
}

export function ensureCsrfCookie(c: {
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

export function resetEmailText(opts: { resetUrl: string; eventName: string | null }): string {
  const reasonLine = opts.eventName
    ? `You're receiving this because you have an account for ${opts.eventName}.`
    : "You're receiving this because you have a Chautauqua account.";
  return renderTemplate(RESET_EMAIL_TEMPLATE, { reset_link: opts.resetUrl, reason_line: reasonLine });
}
