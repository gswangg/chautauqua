// Middleware names per DEC-012: sessionLoader (always-on), requireOrganizer/
// requireReviewer/requireSpeaker (401 no session, 403 wrong role), csrfJson
// (x-chq-csrf header), csrfForm (double-submit chq_csrf cookie). The pure
// session-resolution logic (resolveAuth) is factored out and tested against
// tiny fakes, per the DEC-012 testing strategy.

import type { Context, MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv, AuthInfo } from "./env";
import type { Db } from "./context";
import * as schema from "../db/schema";
import {
  parseCookies,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER,
} from "../auth/cookies";
import { hashToken } from "../auth/tokens";
import { ApiError } from "./http";
import { DEC_027, DEC_276 } from "../decisions";
import { executionCtxOf } from "./execution-ctx";
import { responseHasHeader, setResponseHeaders } from "./response-headers";

void DEC_027;
void DEC_276;

// ---------------------------------------------------------------------------
// Pure session-resolution core (testable against fakes, no Hono/D1 needed)
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  orgId: string;
  role: string;
  contactId: string | null;
}

export interface SessionUserRow {
  expiresAt: number;
  user: UserRow;
}

// DEC-276 amendment (wave 63): a single joined lookup replaces the former
// SessionLookup + UserLookup pair — one D1 round trip instead of two
// sequential SELECTs on every authenticated request.
export interface SessionUserLookup {
  findSessionUser(tokenHash: string): Promise<SessionUserRow | null>;
}

const VALID_ROLES = new Set(["organizer", "reviewer", "speaker"]);

function assertRole(role: string): asserts role is AuthInfo["role"] {
  if (!VALID_ROLES.has(role)) {
    throw new Error(`Unknown user role '${role}'`);
  }
}

/**
 * Resolves the chq_session cookie value to an AuthInfo, or undefined when
 * there's no cookie, no matching (unexpired) session, or no matching user.
 * Fails loudly (throws) only on data corruption (unknown role literal).
 */
export async function resolveAuth(
  token: string | undefined,
  lookup: SessionUserLookup,
  now: number,
): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const tokenHash = await hashToken(token);
  const row = await lookup.findSessionUser(tokenHash);
  if (!row || row.expiresAt <= now) return undefined;
  const { user } = row;
  assertRole(user.role);
  return {
    userId: user.id,
    role: user.role,
    orgId: user.orgId,
    contactId: user.contactId ?? undefined,
  };
}

function drizzleSessionUserLookup(db: Db): SessionUserLookup {
  return {
    async findSessionUser(tokenHash) {
      // DEC-558: at most one row by construction — `auth_session_token_hash_idx`
      // is a uniqueIndex on schema.authSession.tokenHash.
      const rows = await db
        .select({
          expiresAt: schema.authSession.expiresAt,
          userId: schema.user.id,
          orgId: schema.user.orgId,
          role: schema.user.role,
          contactId: schema.user.contactId,
        })
        .from(schema.authSession)
        .innerJoin(schema.user, eq(schema.authSession.userId, schema.user.id))
        .where(eq(schema.authSession.tokenHash, tokenHash))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        expiresAt: row.expiresAt.getTime(),
        user: { id: row.userId, orgId: row.orgId, role: row.role, contactId: row.contactId },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Bearer API tokens (DEC-027)
// ---------------------------------------------------------------------------

export const BEARER_TOKEN_PREFIX = "chq_";

export interface ApiTokenUserRow {
  tokenOrgId: string;
  user: UserRow;
}

// DEC-276 amendment (wave 63): a single joined lookup replaces the former
// ApiTokenLookup + UserLookup pair — one D1 round trip instead of two.
export interface ApiTokenUserLookup {
  findTokenUser(tokenHash: string): Promise<ApiTokenUserRow | null>;
}

/** Extracts a `chq_...` bearer token from an `Authorization` header value,
 * or undefined when absent/not a bearer chq_ token. */
export function extractBearerToken(authorizationHeader: string | undefined | null): string | undefined {
  if (!authorizationHeader) return undefined;
  const match = /^Bearer\s+(chq_\S+)$/.exec(authorizationHeader.trim());
  return match ? match[1] : undefined;
}

/**
 * Resolves a `chq_...` bearer token to an AuthInfo (plus the tokenHash the
 * lookup used, so the caller can stamp api_token.last_used_at without
 * re-hashing), or undefined when there's no token, no matching api_token
 * row, or the minting user no longer qualifies. Per DEC-276, tokens carry no
 * privilege of their own: every request re-resolves the user who minted the
 * token (via createdByUserId) and requires that user to still exist, still
 * hold role='organizer', and still belong to the token's org — so demoting,
 * deleting, or moving that user to another org revokes the token's authority
 * immediately, without a token expiry column. A row with a role literal
 * outside the known set is data corruption (assertRole throws, per DEC-012
 * fail-loudly) rather than silently degrading to undefined.
 */
export async function resolveBearerAuth(
  token: string | undefined,
  lookup: ApiTokenUserLookup,
  hashFn: (token: string) => Promise<string>,
): Promise<{ auth: AuthInfo; tokenHash: string } | undefined> {
  if (!token) return undefined;
  const tokenHash = await hashFn(token);
  const row = await lookup.findTokenUser(tokenHash);
  if (!row) return undefined;
  const { user } = row;
  assertRole(user.role);
  if (user.role !== "organizer") return undefined;
  if (user.orgId !== row.tokenOrgId) return undefined;
  return {
    auth: { userId: user.id, role: user.role, orgId: user.orgId, viaBearer: true },
    tokenHash,
  };
}

function drizzleApiTokenUserLookup(db: Db): ApiTokenUserLookup {
  return {
    async findTokenUser(tokenHash) {
      // DEC-558: at most one row by construction — `api_token_token_hash_idx`
      // is a uniqueIndex on schema.apiToken.tokenHash.
      const rows = await db
        .select({
          tokenOrgId: schema.apiToken.orgId,
          userId: schema.user.id,
          userOrgId: schema.user.orgId,
          role: schema.user.role,
          contactId: schema.user.contactId,
        })
        .from(schema.apiToken)
        .innerJoin(schema.user, eq(schema.apiToken.createdByUserId, schema.user.id))
        .where(eq(schema.apiToken.tokenHash, tokenHash))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        tokenOrgId: row.tokenOrgId,
        user: { id: row.userId, orgId: row.userOrgId, role: row.role, contactId: row.contactId },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Hono middleware
// ---------------------------------------------------------------------------

/** Best-effort stamps api_token.last_used_at off the request's critical
 * path (DEC-276 amendment, wave 63): fired through c.executionCtx.waitUntil
 * when an ExecutionContext is present (production Worker requests), or
 * awaited inline inside a try/catch otherwise (e.g. tests) — either way a
 * stamp failure can never turn an authenticated read into a 500. Reuses the
 * tokenHash the resolver already computed rather than hashing again. */
async function stampApiTokenLastUsed(c: Context<AppEnv>, db: Db, tokenHash: string): Promise<void> {
  const write = async () => {
    try {
      await db
        .update(schema.apiToken)
        .set({ lastUsedAt: new Date() })
        .where(eq(schema.apiToken.tokenHash, tokenHash));
    } catch (err) {
      console.error("api_token last_used_at stamp failed", err);
    }
  };
  const executionCtx = executionCtxOf(c);
  if (executionCtx) {
    executionCtx.waitUntil(write());
    return;
  }
  await write();
}

/** Always-on: parses chq_session, sets c.var.auth when a live session
 * matches; falls back to an `Authorization: Bearer chq_...` API token
 * (DEC-027) when no cookie session resolved. Bearer auth best-effort stamps
 * api_token.last_used_at off the critical path — that write never gates
 * whether auth is set, and can never turn this request into a 500. */
export const sessionLoader: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const token = cookies[SESSION_COOKIE_NAME];
  const db = c.var.db;
  const auth = await resolveAuth(token, drizzleSessionUserLookup(db), Date.now());
  if (auth) {
    c.set("auth", auth);
    await next();
    return;
  }

  const bearerToken = extractBearerToken(c.req.header("authorization"));
  if (bearerToken) {
    const resolved = await resolveBearerAuth(bearerToken, drizzleApiTokenUserLookup(db), hashToken);
    if (resolved) {
      c.set("auth", resolved.auth);
      await stampApiTokenLastUsed(c, db, resolved.tokenHash);
    }
  }

  await next();
};

function requireRole(role: AuthInfo["role"]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.var.auth;
    if (!auth) {
      throw new ApiError("unauthorized", "Login required");
    }
    if (auth.role !== role) {
      throw new ApiError("forbidden", `Requires role '${role}'`);
    }
    await next();
  };
}

export const requireOrganizer = requireRole("organizer");
export const requireReviewer = requireRole("reviewer");
export const requireSpeaker = requireRole("speaker");

/** DEC-027 wave-38 amendment: closes the bearer-token privilege escalation
 * on org-user credential routes (account creation, password reset/reissue,
 * role change, API token management). A bearer-authenticated request
 * (auth.viaBearer) can authenticate as an organizer but must never be able
 * to mint credentials for itself or others — CSRF exemption for bearer
 * clients (see csrfJson below) makes that path CSRF-immune too, so a
 * missing session check here is a full escalation, not just a CSRF gap.
 * This is the ONE assembler of that refusal: every credential-bearing route
 * places this immediately after requireOrganizer (or the relevant role
 * guard) rather than re-implementing the check inline. */
export const requireCookieSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.auth) {
    throw new ApiError("unauthorized", "Login required");
  }
  if (c.var.auth.viaBearer) {
    throw new ApiError("forbidden", "This action requires a signed-in session, not an API token");
  }
  await next();
};

/** JSON mutations under /api/v1: header 'x-chq-csrf: 1' per DEC-004.
 * Exempt when auth.viaBearer (DEC-027): CSRF protects cookie sessions
 * (ambient browser credentials); bearer clients present the token
 * explicitly on every request and cannot be cross-site-forged. */
export const csrfJson: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.auth?.viaBearer && c.req.header(CSRF_HEADER) !== "1") {
    throw new ApiError("invalid", "Missing or invalid CSRF header");
  }
  await next();
};

/** Plain HTML form posts (public CFP, portal, /login, /claim): double-submit
 * cookie 'chq_csrf' compared against a same-named hidden form field. */
export const csrfForm: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("htmlSurface", true);
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  if (!cookieToken) {
    throw new ApiError("invalid", "Missing CSRF cookie");
  }
  const body = await c.req.parseBody();
  const formToken = body[CSRF_COOKIE_NAME];
  if (!checkDoubleSubmitCsrf(cookieToken, formToken)) {
    throw new ApiError("invalid", "CSRF token mismatch");
  }
  await next();
};

/** DEC-658: app-wide default — every response is 'Cache-Control: no-store'
 * (added only when the handler hasn't already set its own Cache-Control) so
 * that no route can accidentally go uncached-by-default. Public SSR surfaces
 * that intentionally own a stronger opinion (pubcache.ts's
 * publicCacheMiddleware / CLIENT_CACHE_CONTROL restore, setCacheHeaders in
 * routes/public/index.tsx, the portal headshot long-lived header, whatever
 * the ASSETS binding returns) are unaffected because they set the header
 * themselves before this runs its post-next() check. One default, one
 * exception rule — no per-prefix allowlist to keep in sync as routes land. */
export const noStoreByDefault: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!responseHasHeader(c, "Cache-Control")) {
    setResponseHeaders(c, [["Cache-Control", "no-store"]]);
  }
};

/** DEC-544: THE double-submit CSRF comparison rule. csrfForm and
 * csrfFormOrHeader both delegate to this — it is not a test-only helper,
 * it is the predicate that actually guards every plain-form CSRF-checked
 * route. Do not re-inline this comparison anywhere else. */
export function checkDoubleSubmitCsrf(cookieToken: string | undefined, formToken: unknown): boolean {
  return typeof cookieToken === "string" && cookieToken.length > 0 && formToken === cookieToken;
}

// DEC-181
/** Accepts either the JSON-style 'x-chq-csrf: 1' header (used by the admin
 * SPA's fetch-based sign-out) or the plain-form double-submit rule (used by
 * server-rendered portal/auth sign-out forms). Closes the /logout CSRF hole
 * without forcing every caller onto one shape. */
export const csrfFormOrHeader: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("htmlSurface", true);
  if (c.req.header(CSRF_HEADER) === "1") {
    await next();
    return;
  }
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  if (!cookieToken) {
    throw new ApiError("invalid", "Missing CSRF cookie");
  }
  const body = await c.req.parseBody();
  const formToken = body[CSRF_COOKIE_NAME];
  if (!checkDoubleSubmitCsrf(cookieToken, formToken)) {
    throw new ApiError("invalid", "CSRF token mismatch");
  }
  await next();
};
