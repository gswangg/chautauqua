// Worker bindings + request-scoped context shape, per DEC-012.
// This is the ONLY place Bindings/AppEnv are defined; src/index.ts and every
// route sub-app type their Hono instance as Hono<AppEnv>.

import type { Db } from "./context";

export type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  DEV_MODE?: string;
  // DEC-252: overrides resolveBaseUrl()'s origin inference for user-facing
  // absolute links (e.g. `wrangler dev --var PUBLIC_BASE_URL:http://localhost:8801`
  // for a non-default port). Must be an absolute http/https URL when set.
  PUBLIC_BASE_URL?: string;
  // DEC-996 amendment (wave 57): production mail goes through the Cloudflare
  // Email Service `send_email` binding — no API keys. Optional so test env
  // fixtures and pre-deploy local dev stay green; makeMailer only selects
  // EmailBindingMailer when EMAIL is bound and isDevMode(env) is false.
  // Structural (DEC-002: env.ts never imports `cloudflare:email`) — the real
  // EmailMessage construction lives in src/server/context.ts.
  EMAIL?: { send(message: unknown): Promise<unknown> };
  // Stage 2: sender identity for the EMAIL binding. Optional so test env
  // fixtures and pre-deploy local dev stay green.
  MAIL_FROM_EMAIL?: string;
  MAIL_FROM_NAME?: string;
  // Optional one-way Airtable sync (bonus): both must be set (as Worker
  // secrets) or the sync is off. Airtable is never a source of truth.
  AIRTABLE_TOKEN?: string;
  AIRTABLE_BASE_ID?: string;
  // DEC-450: one Airtable base serves exactly one org. Required once
  // AIRTABLE_TOKEN/AIRTABLE_BASE_ID are set — the sync throws otherwise.
  AIRTABLE_ORG_ID?: string;
  // DEC-049: /admin is served through the Worker (run_worker_first) so role
  // redirects can happen server-side; ASSETS proxies to the static bundle.
  // Optional so existing test env fixtures that predate this task stay green.
  ASSETS?: Fetcher;
};

export type AuthInfo = {
  userId: string;
  role: "organizer" | "reviewer" | "speaker";
  orgId: string;
  contactId?: string;
  // DEC-027: set when this request authenticated via an `Authorization:
  // Bearer chq_...` API token rather than the chq_session cookie. Bearer
  // requests are CSRF-exempt (cross-site forgery requires ambient cookie
  // credentials) and can never mint new tokens themselves.
  viaBearer?: boolean;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: Db;
    auth?: AuthInfo;
    // DEC-626: set by csrfForm/csrfFormOrHeader before any validation/throw
    // -- marks the request as originating from a plain HTML form post, so
    // registerErrorHandler renders a minimal HTML page (same status) instead
    // of the JSON error envelope on a thrown ApiError.
    htmlSurface?: boolean;
  };
};

/** DEC-434: the ONE dev-mode predicate. `DEV_MODE === "1"` is the ONLY value
 * that means dev mode — every other value (unset, "", "0", "true", "yes",
 * ...) means production/non-dev. Every gate in the codebase (makeMailer's
 * mailer selection, shouldMountDevMailbox, resolveBaseUrl's loopback
 * sniffing) MUST delegate to this function rather than re-spelling the
 * comparison, so DEV_MODE="0" can never silently select dev behavior in one
 * place (truthiness) while a strict-equality check elsewhere disagrees. */
export function isDevMode(env: Pick<Bindings, "DEV_MODE">): boolean {
  return env.DEV_MODE === "1";
}

/** DEC-996 amendment (wave 57): the ONE predicate/read for "is mail
 * configured" -- the single source for makeMailer's selection
 * (src/server/context.ts), GET /api/v1/mail-status, and the Settings "Email"
 * definition row. isDevMode(env) is checked FIRST (DEC-434), so a dev worker
 * always reports 'dev-sink' even if EMAIL is bound. A non-dev deployment is
 * 'email-binding' only when BOTH the EMAIL binding and MAIL_FROM_EMAIL are
 * set (mirrors makeMailer's two separate throws under DEC-547), otherwise
 * 'none'. fromEmail reflects env.MAIL_FROM_EMAIL verbatim (or null) in every
 * provider state -- including 'none', where a set from-address with no bound
 * EMAIL is exactly what an operator needs to see. */
export function mailConfigStatus(
  env: Pick<Bindings, "EMAIL" | "DEV_MODE" | "MAIL_FROM_EMAIL" | "MAIL_FROM_NAME">,
): { provider: "dev-sink" | "email-binding" | "none"; configured: boolean; fromEmail: string | null } {
  const fromEmail = env.MAIL_FROM_EMAIL ?? null;
  if (isDevMode(env)) return { provider: "dev-sink", configured: true, fromEmail };
  if (env.EMAIL && env.MAIL_FROM_EMAIL) return { provider: "email-binding", configured: true, fromEmail };
  return { provider: "none", configured: false, fromEmail };
}
