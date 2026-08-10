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
// Hono middleware
// ---------------------------------------------------------------------------

/** Always-on: parses chq_session, sets c.var.auth when a live session matches. */
export const sessionLoader: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const token = cookies[SESSION_COOKIE_NAME];
  const db = c.var.db;
  const auth = await resolveAuth(token, drizzleSessionLookup(db), drizzleUserLookup(db), Date.now());
  if (auth) {
    c.set("auth", auth);
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

/** JSON mutations under /api/v1: header 'x-chq-csrf: 1' per DEC-004. */
export const csrfJson: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.header(CSRF_HEADER) !== "1") {
    throw new ApiError("invalid", "Missing or invalid CSRF header");
  }
  await next();
};

/** Plain HTML form posts (public CFP, portal, /login, /claim): double-submit
 * cookie 'chq_csrf' compared against a same-named hidden form field. */
export const csrfForm: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  if (!cookieToken) {
    throw new ApiError("invalid", "Missing CSRF cookie");
  }
  const body = await c.req.parseBody();
  const formToken = body[CSRF_COOKIE_NAME];
  if (typeof formToken !== "string" || formToken !== cookieToken) {
    throw new ApiError("invalid", "CSRF token mismatch");
  }
  await next();
};

/** Pure helper for tests: same rule csrfForm applies, without a Hono context. */
export function checkDoubleSubmitCsrf(cookieToken: string | undefined, formToken: unknown): boolean {
  return typeof cookieToken === "string" && cookieToken.length > 0 && formToken === cookieToken;
}
