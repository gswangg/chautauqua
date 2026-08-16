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
import { checkAndIncrementScopedLimit, refundScopedLimit } from "../server/repo/rate-limit";
import { isUniqueViolation } from "../server/repo/constraints";
import { ClaimPage, ExpiredClaimPage, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "./auth-views";
import { ensureCsrfCookie, AUTH_RATE_LIMIT_WINDOW_SECONDS, AUTH_RATE_LIMIT_MAX, RATE_LIMIT_ERROR } from "./auth-helpers";
import { DEC_949, DEC_014, DEC_064 } from "../decisions";

void DEC_949;
void DEC_014;
void DEC_064;

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
  const db = c.var.db;

  // DEC-949 (wave 46 amendment): the per-IP `claim` bucket is a FAILURE
  // budget, not an admission gate. Under local wrangler dev every client
  // resolves to the literal string "unknown" (rate-limit.ts's own
  // doc-comment), so an admission-gate shape would share one counter
  // across every speaker on the box and 429 a perfectly valid token once
  // twenty unrelated attempts land first. Mirroring DEC-072 wave-38's
  // consume-then-refund shape (the only atomic shape DEC-948/DEC-180
  // allow — a peek-then-increment pair would reopen the exact
  // read-then-write race those decisions forbid): the unit is spent
  // unconditionally at admission, then given back the instant the token
  // is known to resolve, before it is consulted for anything else. A
  // request whose token resolves therefore never sees a 429 and leaves
  // the budget untouched net; a request whose token misses keeps the
  // spent unit and 429s once the budget is exhausted.
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const claimNow = Date.now();
  const limit = await checkAndIncrementScopedLimit(db, "claim", ip, claimNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });

  // DEC-064 (wave-66 amendment): peek the record without consuming it. Any
  // validation failure below (short password, duplicate user) must leave
  // the one-time link claimable. The write phase below no longer treats
  // consumeClaimToken as the serializer either -- see the note above the
  // insert.
  const record = await readClaimToken(kv, token);
  if (!record) {
    if (!limit.ok) {
      const { token: csrfToken } = ensureCsrfCookie(c);
      return c.html(<ClaimPage csrfToken={csrfToken} error={RATE_LIMIT_ERROR} />, 429);
    }
    throw new ApiError("not_found", "This link is invalid or has expired.");
  }

  // Token resolved: refund the unit just spent so a real speaker with a
  // real token is never throttled by unrelated failed attempts sharing
  // this IP bucket.
  await refundScopedLimit(db, "claim", ip, claimNow, { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS });

  const body = await c.req.parseBody();
  const password = String(body.password ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError("invalid", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, {
      password: "Too short",
    });
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError("invalid", `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`, {
      password: "Too long",
    });
  }

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

  // DEC-064 (wave-66 amendment): the INSERT is the serializer, not the KV
  // consume. user_email_idx (a global unique index) is what actually makes
  // a second claim of the same grant impossible under concurrency -- so the
  // insert runs FIRST, before the token is touched. A unique-constraint
  // failure here means another request (or another account entirely) won
  // the email, and is answered with the same /login redirect the
  // pre-existing-account check above already returns, leaving the grant
  // unconsumed and the link still usable. Any other insert failure (a D1
  // transient, etc.) propagates loudly and — because the token is still
  // unconsumed — a retry with the same link succeeds.
  const passwordHash = await hashPassword(password);
  const now = new Date();
  const userId = newId();
  try {
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
  } catch (err) {
    if (isUniqueViolation(err, "user.email")) {
      return c.redirect("/login", 302);
    }
    throw err;
  }

  // This request's insert won the race (the unique index above is the only
  // gate), so it is the one and only winner entitled to consume the grant.
  // A `false` return here (another request already deleted the KV record,
  // e.g. a retry of a request whose insert actually succeeded but whose
  // response was lost) is not fatal -- the user row this request just
  // created is real and correct, so the claim proceeds to a session
  // regardless.
  await consumeClaimToken(kv, token);

  // DEC-949 (wave 27 amendment, wired per wave 29): claiming an account sets
  // a fresh credential — any outstanding password-reset grant for this user
  // (mintable only once a matching user row exists, so this is the earliest
  // point userId is known) must not survive it. Not best-effort: a KV error
  // here propagates. The user row above is a point of no return (DEC-547
  // doctrine) — a failure past this point never re-runs the insert, it
  // surfaces to the speaker who can sign in at /login with the password
  // they just set.
  await revokeResetTokenForUser(kv, userId);

  const sessionToken = await issueSessionRevokingAll(db, userId, now);

  c.header("Set-Cookie", buildSessionCookie(sessionToken, { secure: isSecureRequest(c.req.url) }));
  return c.redirect("/portal", 302);
});
