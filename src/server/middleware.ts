// Middleware names per DEC-012: sessionLoader (always-on), requireOrganizer/
// requireReviewer/requireSpeaker (401 no session, 403 wrong role), csrfJson
// (x-chq-csrf header), csrfForm (double-submit chq_csrf cookie). The pure
// session-resolution logic (resolveAuth) is factored out and tested against
// tiny fakes, per the DEC-012 testing strategy.

import type { MiddlewareHandler } from "hono";
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

void DEC_027;
void DEC_276;

// ---------------------------------------------------------------------------
// Pure session-resolution core (testable against fakes, no Hono/D1 needed)
// ---------------------------------------------------------------------------

export interface SessionRow {
  userId: string;
  expiresAt: number;
}

export interface UserRow {
  id: string;
  orgId: string;
  role: string;
  contactId: string | null;
}

export interface SessionLookup {
  findByTokenHash(tokenHash: string): Promise<SessionRow | null>;
}

export interface UserLookup {
  findById(userId: string): Promise<UserRow | null>;
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
  sessions: SessionLookup,
  users: UserLookup,
  now: number,
): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const tokenHash = await hashToken(token);
  const session = await sessions.findByTokenHash(tokenHash);
  if (!session || session.expiresAt <= now) return undefined;
  const user = await users.findById(session.userId);
  if (!user) return undefined;
  assertRole(user.role);
  return {
    userId: user.id,
    role: user.role,
    orgId: user.orgId,
    contactId: user.contactId ?? undefined,
  };
}

function drizzleSessionLookup(db: Db): SessionLookup {
  return {
    async findByTokenHash(tokenHash) {
      const rows = await db
        .select({ userId: schema.authSession.userId, expiresAt: schema.authSession.expiresAt })
        .from(schema.authSession)
        .where(eq(schema.authSession.tokenHash, tokenHash))
        .limit(1);
      const row = rows[0];
      return row ? { userId: row.userId, expiresAt: row.expiresAt.getTime() } : null;
    },
  };
}

function drizzleUserLookup(db: Db): UserLookup {
  return {
    async findById(userId) {
      const rows = await db
        .select({
          id: schema.user.id,
          orgId: schema.user.orgId,
          role: schema.user.role,
          contactId: schema.user.contactId,
        })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .limit(1);
      return rows[0] ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Bearer API tokens (DEC-027)
// ---------------------------------------------------------------------------

export const BEARER_TOKEN_PREFIX = "chq_";

export interface ApiTokenRow {
  id: string;
  orgId: string;
  createdByUserId: string;
}

export interface ApiTokenLookup {
  findByTokenHash(tokenHash: string): Promise<ApiTokenRow | null>;
}

/** Extracts a `chq_...` bearer token from an `Authorization` header value,
 * or undefined when absent/not a bearer chq_ token. */
export function extractBearerToken(authorizationHeader: string | undefined | null): string | undefined {
  if (!authorizationHeader) return undefined;
  const match = /^Bearer\s+(chq_\S+)$/.exec(authorizationHeader.trim());
  return match ? match[1] : undefined;
}

/**
 * Resolves a `chq_...` bearer token to an AuthInfo, or undefined when there's
 * no token, no matching api_token row, or the minting user no longer
 * qualifies. Per DEC-276, tokens carry no privilege of their own: every
 * request re-resolves the user who minted the token (via createdByUserId)
 * and requires that user to still exist, still hold role='organizer', and
 * still belong to the token's org — so demoting, deleting, or moving that
 * user to another org revokes the token's authority immediately, without a
 * token expiry column. A row with a role literal outside the known set is
 * data corruption (assertRole throws, per DEC-012 fail-loudly) rather than
 * silently degrading to undefined.
 */
export async function resolveBearerAuth(
  token: string | undefined,
  tokens: ApiTokenLookup,
  users: UserLookup,
  hashFn: (token: string) => Promise<string>,
): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const tokenHash = await hashFn(token);
  const row = await tokens.findByTokenHash(tokenHash);
  if (!row) return undefined;
  const user = await users.findById(row.createdByUserId);
  if (!user) return undefined;
  assertRole(user.role);
  if (user.role !== "organizer") return undefined;
  if (user.orgId !== row.orgId) return undefined;
  return {
    userId: user.id,
    role: user.role,
    orgId: user.orgId,
    viaBearer: true,
  };
}

function drizzleApiTokenLookup(db: Db): ApiTokenLookup {
  return {
    async findByTokenHash(tokenHash) {
      const rows = await db
        .select({
          id: schema.apiToken.id,
          orgId: schema.apiToken.orgId,
          createdByUserId: schema.apiToken.createdByUserId,
        })
        .from(schema.apiToken)
        .where(eq(schema.apiToken.tokenHash, tokenHash))
        .limit(1);
      return rows[0] ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Hono middleware
// ---------------------------------------------------------------------------

/** Always-on: parses chq_session, sets c.var.auth when a live session
 * matches; falls back to an `Authorization: Bearer chq_...` API token
 * (DEC-027) when no cookie session resolved. Bearer auth best-effort stamps
 * api_token.last_used_at — that write never gates whether auth is set. */
export const sessionLoader: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const token = cookies[SESSION_COOKIE_NAME];
  const db = c.var.db;
  const auth = await resolveAuth(token, drizzleSessionLookup(db), drizzleUserLookup(db), Date.now());
  if (auth) {
    c.set("auth", auth);
    await next();
    return;
  }

  const bearerToken = extractBearerToken(c.req.header("authorization"));
  if (bearerToken) {
    const bearerAuth = await resolveBearerAuth(bearerToken, drizzleApiTokenLookup(db), drizzleUserLookup(db), hashToken);
    if (bearerAuth) {
      c.set("auth", bearerAuth);
      const tokenHash = await hashToken(bearerToken);
      await db
        .update(schema.apiToken)
        .set({ lastUsedAt: new Date() })
        .where(eq(schema.apiToken.tokenHash, tokenHash));
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
  if (!c.res.headers.has("Cache-Control")) {
    c.res.headers.set("Cache-Control", "no-store");
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
