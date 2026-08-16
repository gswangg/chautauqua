// /forgot and /reset/:token routes extracted from src/routes/auth.tsx
// (contention decomposition, no behavior change). Mounted at "/" by
// auth.tsx.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { csrfForm } from "../server/middleware";
import * as schema from "../db/schema";
import { hashPassword } from "../auth/password";
import { issueSessionRevokingAll } from "../server/auth-session";
import { isSecureRequest } from "../auth/cookies";
import { type KVStore } from "../auth/claim";
import {
  createResetToken,
  readResetToken,
  consumeResetToken,
  hashResetToken,
  newResetToken,
} from "../auth/password-reset";
import { requestIpFromHeaders } from "../lib/rate-limit";
import { checkAndIncrementScopedLimit, refundScopedLimit } from "../server/repo/rate-limit";
import { getAnchorEventForOrg } from "../server/repo/events";
import { makeMailer } from "../server/context";
import { resolveBaseUrl } from "../server/origin";
import { renderEmailHtml } from "../mail/shell";
import {
  ForgotPasswordPage,
  CheckEmailPage,
  ResetPasswordPage,
  ExpiredResetPage,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "./auth-views";
import {
  ensureCsrfCookie,
  resetEmailText,
  AUTH_RATE_LIMIT_WINDOW_SECONDS,
  AUTH_RATE_LIMIT_MAX,
  RATE_LIMIT_ERROR,
} from "./auth-helpers";
import { DEC_994, DEC_014, DEC_180, DEC_004 } from "../decisions";
import { executionCtxOf } from "../server/execution-ctx";

void DEC_994;
void DEC_014;
void DEC_180;
void DEC_004;

// -----------------------------------------------------------------------
// Password reset (DEC-014 wave-25 amendment / DEC-154 / DEC-180 / DEC-994).
// -----------------------------------------------------------------------

export const resetRoutes = new Hono<AppEnv>();

resetRoutes.get("/forgot", async (c) => {
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
  return c.html(<ForgotPasswordPage csrfToken={csrfToken} />);
});

resetRoutes.post("/forgot", csrfForm, async (c) => {
  const db = c.var.db;
  const body = await c.req.parseBody();
  const submittedEmail = String(body.email ?? "").trim();
  const normalizedEmail = submittedEmail.toLowerCase();
  const now = Date.now();

  // DEC-180 (wave-36 amendment): a per-email bucket alone lets an attacker
  // spray one request per distinct address and never hit the same email
  // bucket twice, minting unlimited reset tokens and unlimited mail. Mirror
  // /login's two-bucket shape: an IP bucket FIRST, then the per-email
  // bucket. IP-first is load-bearing — a denial there must not touch the
  // email budget at all (no partial spend to refund), keeping the two
  // checks independent rather than sequenced-with-refund like /login's
  // success path (which /forgot does not have, per corollary (2) below).
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const ipLimit = await checkAndIncrementScopedLimit(db, "forgot-ip", ip, now, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: 100,
  });
  if (!ipLimit.ok) {
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(<ForgotPasswordPage csrfToken={csrfToken} email={submittedEmail} error={RATE_LIMIT_ERROR} />, 429);
  }

  // DEC-948 / DEC-180 (wave-29 amendment): the SAME atomic consume shape as
  // /login, keyed on the normalised email — the deleted read-only peek
  // helper keeps no auth call site. One atomic D1 upsert up front, so N
  // concurrent requests
  // against one address land on distinct counts and exactly one crosses the
  // cap. Per DEC-180 wave-29 corollary (2), /forgot CONSUMES ALWAYS AND
  // NEVER REFUNDS: refunding only when the address exists (or only when it
  // does not) would make bucket depletion an account-enumeration oracle,
  // which DEC-004 closes everywhere else. A 429 here doesn't leak existence
  // (it fires purely off request volume against one address, known or not).
  // This applies equally to the IP bucket above: neither bucket is ever
  // refunded by this handler.
  const forgotLimit = await checkAndIncrementScopedLimit(db, "forgot", normalizedEmail, now, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });
  if (!forgotLimit.ok) {
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

  // Hoisted above the branch (task-w34-c): resolveBaseUrl(c) must run
  // identically on both branches. A deployment missing PUBLIC_BASE_URL has
  // to fail the SAME way for a known and an unknown address — living only
  // inside `if (user)` would 500 on a real account and 200 on a fake one,
  // a DEC-004 enumeration oracle.
  const origin = resolveBaseUrl(c);

  // DEC-004 (wave-44 amendment): the same TIMING oracle DEC-004's wave-58
  // amendment closed at /login (the dummy-hash equalisation) exists here —
  // the known-address branch below awaits a KV write, a D1 read and a
  // mailer send (a provider HTTP call in production) while the unknown
  // branch pays one hashResetToken, so the WALL CLOCK (not the response
  // bytes, already byte-identical per the wave-27 amendment above) leaks
  // account existence. `branchWork` bundles the entire branch-dependent
  // side effect so it can be scheduled identically on both branches:
  // handed to `ctx.waitUntil` when an ExecutionContext is available (the
  // response returns before either branch's IO happens, so neither
  // branch's wall-clock cost is observable), and `await`ed inline only
  // when no ExecutionContext exists (vitest's node environment, mirroring
  // servePublicGet's fallback in src/server/pubcache.ts) — so every
  // direct-call test (test/password-reset-flow.test.ts included) still
  // observes the minted token and the sent mail with no edit.
  async function branchWork(): Promise<void> {
    if (user) {
      const kv = c.env.KV as unknown as KVStore;
      const resetToken = await createResetToken(kv, user.id);
      const resetUrl = `${origin}/reset/${resetToken}`;

      // email_log.event_id is NOT NULL (DEC-006); a password reset isn't
      // event-scoped, so — mirroring POST /api/v1/users' welcome-email
      // anchoring (src/routes/api/users.ts) — the send is logged against
      // the org's first event when one exists. An org with zero events
      // still mints and stores the token (the on-screen response is
      // identical either way) but has no event to log the send against, so
      // sending is skipped. No design doc covers this gap; narrowest
      // reading, flagged for the scribe.
      const anchorEvent = await getAnchorEventForOrg(db, user.orgId);
      if (!anchorEvent) {
        // Mint without delivery (task-w34-c): the token is live but there is
        // no event to log the send against, so no email goes out. This must
        // stay silent on the wire — the response below is byte-identical to
        // every other branch — but a mint with nobody able to receive it is
        // worth a loud server-side signal.
        console.error(`password reset minted with no send: no events for org (userId '${user.id}')`);
      }
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
      // No resetScopedLimit here — the atomic spend above already counted
      // this request against the budget, and (per DEC-180 wave-29) /forgot
      // never refunds, existing account or not, so the two branches stay
      // indistinguishable from the budget's point of view.
    } else {
      // No account: burn a comparable SHA-256 cost to the mint path above
      // (DEC-004-style — never short-circuit past the work a real branch
      // would do). The budget was already spent atomically at admission
      // above, before this branch ran — nothing further to record.
      await hashResetToken(newResetToken());
    }
  }

  const ctx = executionCtxOf(c);
  if (ctx) {
    ctx.waitUntil(branchWork());
  } else {
    await branchWork();
  }

  return c.html(<CheckEmailPage />);
});

resetRoutes.get("/reset/:token", async (c) => {
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

resetRoutes.post("/reset/:token", csrfForm, async (c) => {
  const token = c.req.param("token");
  const kv = c.env.KV as unknown as KVStore;
  const db = c.var.db;

  // DEC-949-style consume-then-refund (mirrors POST /claim/:token in
  // auth-claim.tsx exactly): the per-IP `reset-token` bucket is a FAILURE
  // budget for guessed tokens, not an admission gate — under local wrangler
  // dev every client resolves to the literal string "unknown"
  // (rate-limit.ts's own doc-comment), so an admission-gate shape would
  // share one counter across every speaker on the box. The unit is spent
  // unconditionally at admission, then refunded the instant the token is
  // known to resolve, before it is consulted for anything else — a request
  // whose token resolves never sees a 429 and leaves the budget untouched
  // net; a request whose token misses (an attacker guessing) keeps the
  // spent unit and 429s once the budget is exhausted. Filed as a fix
  // (wave-52 enumeration): unlike /claim/:token, this route had no
  // per-token-guess budget at all before this change.
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const resetTokenNow = Date.now();
  const limit = await checkAndIncrementScopedLimit(db, "reset-token", ip, resetTokenNow, {
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
  });

  // Validate-then-consume (task-w34-c, reordering the prior consume-first
  // shape): a mismatched confirm or a too-short password re-renders the
  // SAME form with the SAME token still live, so a mistyped retry doesn't
  // permanently burn the link. Peek (read-only) here; the actual consume
  // happens immediately before the write, below.
  const record = await readResetToken(kv, token);
  if (!record) {
    if (!limit.ok) {
      return c.html(<ExpiredResetPage />, 429);
    }
    return c.html(<ExpiredResetPage />, 410);
  }

  // Token resolved: refund the unit just spent so a real speaker with a
  // real token is never throttled by unrelated failed guesses sharing this
  // IP bucket.
  await refundScopedLimit(db, "reset-token", ip, resetTokenNow, { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS });

  const rows = await db.select().from(schema.user).where(eq(schema.user.id, record.userId)).limit(1);
  const user = rows[0];
  if (!user) {
    throw new Error(`No user row for reset token userId '${record.userId}'`);
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
  if (next.length > MAX_PASSWORD_LENGTH) {
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew);
    return c.html(
      <ResetPasswordPage
        csrfToken={csrfToken}
        email={user.email}
        error={`New password must be at most ${MAX_PASSWORD_LENGTH} characters.`}
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

  // Consume immediately before the write — the gate belongs at the write,
  // not before validation. A null result here is a lost race (another
  // request consumed the same token between the peek above and this call,
  // e.g. two tabs racing a valid submission): treat it as expired rather
  // than proceeding to mutate on a token nobody holds anymore.
  const consumed = await consumeResetToken(kv, token);
  if (!consumed) {
    return c.html(<ExpiredResetPage />, 410);
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
