// /claim/:token routes extracted from src/routes/auth.tsx (contention
// decomposition, no behavior change). Mounted at "/" by auth.tsx.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { csrfForm } from "../server/middleware";
import { ApiError } from "../server/http";
import * as schema from "../db/schema";
import { newId } from "../domain/ids";
import { hashPassword } from "../auth/password";
import { issueSessionRevokingAll } from "../server/auth-session";
import { buildSessionCookie, isSecureRequest } from "../auth/cookies";
import { consumeClaimToken, readClaimToken, type KVStore } from "../auth/claim";
import { revokeResetTokenForUser } from "../auth/password-reset";
import { findAccountUserId } from "../server/repo/comms";
import { requestIpFromHeaders } from "../lib/rate-limit";
import { checkAndIncrementScopedLimit } from "../server/repo/rate-limit";
import { ClaimPage, ExpiredClaimPage, MIN_PASSWORD_LENGTH } from "./auth-views";
import { ensureCsrfCookie, AUTH_RATE_LIMIT_WINDOW_SECONDS, AUTH_RATE_LIMIT_MAX, RATE_LIMIT_ERROR } from "./auth-helpers";
import { DEC_949, DEC_014 } from "../decisions";

void DEC_949;
void DEC_014;

export const claimRoutes = new Hono<AppEnv>();

claimRoutes.get("/claim/:token", async (c) => {
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

claimRoutes.post("/claim/:token", csrfForm, async (c) => {
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

  // DEC-949 (wave 27 amendment, wired per wave 29): claiming an account sets
  // a fresh credential — any outstanding password-reset grant for this user
  // (mintable only once a matching user row exists, so this is the earliest
  // point userId is known) must not survive it. Not best-effort: a KV error
  // here propagates.
  await revokeResetTokenForUser(kv, userId);

  const sessionToken = await issueSessionRevokingAll(db, userId, now);

  c.header("Set-Cookie", buildSessionCookie(sessionToken, { secure: isSecureRequest(c.req.url) }));
  return c.redirect("/portal", 302);
});
