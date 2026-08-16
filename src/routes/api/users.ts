// Org user directory API (J4, DEC-043/DEC-044): organizer-only management
// of reviewer/organizer accounts. Route file exports a named Hono<AppEnv>
// sub-app; only src/index.ts mounts it (DEC-012/013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { requireOrganizer, requireCookieSession, csrfJson } from "../../server/middleware";
import { ApiError, readJsonBody, collectBoundedOptionalText } from "../../server/http";
import { makeMailer } from "../../server/context";
import { renderEmailHtml } from "../../mail/shell";
import { hashPassword } from "../../auth/password";
import { MAX_PASSWORD_LENGTH } from "../../domain/auth-copy";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { overCapFieldMessage } from "../../domain/cap-copy"; // DEC-422 amendment
import { revokeResetTokenForUser, type KVStore } from "../../auth/password-reset";
import * as repo from "../../server/repo/users";
import { isOrgUserRole } from "../../server/repo/users";
import { getAnchorEventForOrg } from "../../server/repo/events";
import { clampPage, listPerPage } from "../../lib/pagination";
import { normalizeEmail, isValidEmail } from "../../domain/email";
import { DEC_239, DEC_454, DEC_467, DEC_778, DEC_865 } from "../../decisions";

export const usersRoutes = new Hono<AppEnv>();
void DEC_239; // GET /api/v1/users items must retain {id,email,role,...} -- the SPA's ReviewerOption keys on `id`, not `userId`
void DEC_454; // one canonical email rule, applied at every contact.email write/lookup
void DEC_467; // user.email obeys DEC-454 too
void DEC_778; // PATCH /api/v1/users/:id role change -- a role you can see is a role you can change
void DEC_865; // org user directory is organizer/reviewer only -- see repo/users.ts's ORG_USER_ROLES vocabulary

function currentAuth(c: { var: { auth?: { userId: string; role: string; orgId: string } } }) {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

/** Generates a password like 'xxxx-xxxx-xxxx' from lowercase base32 chars,
 * shown exactly once to the organizer creating the account (DEC-043). */
function generatePassword(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    let group = "";
    for (let i = 0; i < 4; i++) {
      group += alphabet[bytes[i]! % alphabet.length];
    }
    groups.push(group);
  }
  return groups.join("-");
}

usersRoutes.get("/api/v1/users", requireOrganizer, async (c) => {
  const auth = currentAuth(c);
  const role = c.req.query("role");
  if (role !== undefined && !isOrgUserRole(role)) {
    throw new ApiError("invalid", "role must be 'reviewer' or 'organizer'", { role: "invalid" });
  }
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  const [items, total] = await Promise.all([
    repo.listOrgUsers(c.var.db, auth.orgId, role, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countOrgUsers(c.var.db, auth.orgId, role),
  ]);
  return c.json({ items, total, page, perPage });
});

usersRoutes.post("/api/v1/users", requireOrganizer, requireCookieSession, csrfJson, async (c) => {
  const auth = currentAuth(c);
  const record = await readJsonBody(c);

  const errors: Record<string, string> = {};
  const email = normalizeEmail(typeof record.email === "string" ? record.email : "");
  if (!isValidEmail(email)) errors.email = "must be a valid email address"; // DEC-454/DEC-467
  const role = typeof record.role === "string" ? record.role : "";
  if (!isOrgUserRole(role)) errors.role = "must be 'reviewer' or 'organizer'";
  // DEC-757: firstName/lastName are OPTIONAL on the wire -- the SPA enforces
  // presence at its own door, but existing API callers (and accounts with no
  // name at all) must keep working. Same bounded-text/errors-map pattern as
  // breaks.ts so an over-cap value lands alongside email/role in one refusal.
  const firstName = collectBoundedOptionalText(record.firstName, "firstName", { max: MAX_NAME_LENGTH }, errors);
  const lastName = collectBoundedOptionalText(record.lastName, "lastName", { max: MAX_NAME_LENGTH }, errors);
  if (Object.keys(errors).length > 0) {
    throw new ApiError("invalid", "Invalid user", errors);
  }
  const name = [firstName, lastName].filter((part): part is string => Boolean(part)).join(" ") || null;

  const password = generatePassword();
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError("invalid", "Invalid user", { password: overCapFieldMessage(password.length, MAX_PASSWORD_LENGTH) });
  }
  const passwordHash = await hashPassword(password);
  const created = await repo.createUser(c.var.db, { orgId: auth.orgId, email, role, passwordHash, name });

  // email_log.event_id is NOT NULL (DEC-006); org user accounts aren't
  // event-scoped, so the welcome email is logged against the org's first
  // event when one exists. A brand-new org with zero events still gets the
  // account + one-time password in the response — no design doc covers this
  // gap, so we take the narrowest reading: no event, no email row, but the
  // account still works. Flagged for the scribe.
  const anchorEvent = await getAnchorEventForOrg(c.var.db, auth.orgId);
  const anchorEventId = anchorEvent?.id;
  const anchorEventName = anchorEvent?.name ?? null;
  // DEC-238 (wave 65 amendment): the 201 body must report which of the three
  // outcomes actually happened -- a closed vocabulary decided server-side,
  // never inferred by the caller.
  let welcomeEmail: "sent" | "not_sent_no_event" | "not_sent_failed";
  if (anchorEventId) {
    // DEC-238: user creation must succeed even if the best-effort welcome
    // notice fails to send (the account, password, and response body are
    // already valid) — catch, log, and continue rather than surfacing a 500
    // for a side-effect email.
    try {
      const mailer = makeMailer(c.var.db, c.env);
      const text = `An account has been created for you.\n\nEmail: ${created.email}\n\nSign in at /login with the temporary password your organizer will share with you; you can change it at /account/password after signing in.`;
      await mailer.send({
        to: { email: created.email, name: created.name && created.name.trim() ? created.name : created.email },
        subject: "Your account has been created",
        text,
        html: renderEmailHtml(text, {
          eventName: anchorEventName,
          reason: "an organizer created a reviewer/organizer account for you",
        }),
        eventId: anchorEventId,
        // DEC-191: this user is not a contact; per-contact email history
        // intentionally excludes rows like this one.
        contactId: null,
      });
      welcomeEmail = "sent";
    } catch (err) {
      console.error("account-creation welcome email failed (account still created):", err);
      welcomeEmail = "not_sent_failed";
    }
  } else {
    welcomeEmail = "not_sent_no_event";
  }

  return c.json(
    { id: created.id, email: created.email, role: created.role, name: created.name, password, welcomeEmail },
    201,
  );
});

// DEC-215: organizer-triggered password re-issue for an org user (reviewer
// or organizer). The fresh one-time password is returned ONLY in this JSON
// response body — never emailed (DEC-200/DEC-043 pattern: passwords never
// travel over email, only the account-creation notice does, and that notice
// omits the password too). The organizer is responsible for relaying it to
// the user out of band.
usersRoutes.post("/api/v1/users/:id/reset-password", requireOrganizer, requireCookieSession, csrfJson, async (c) => {
  const auth = currentAuth(c);
  const userId = c.req.param("id");
  const target = await repo.getOrgUserById(c.var.db, userId, auth.orgId);
  if (!target) throw new ApiError("not_found", "User not found");

  // DEC-949 (wave 43 amendment): revoke the target's outstanding reset
  // grant BEFORE the hash write, since the userId is already known here --
  // a failed write can then never leave a live takeover link outstanding.
  await revokeResetTokenForUser(c.env.KV as unknown as KVStore, target.id);

  const password = generatePassword();
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError("invalid", "Invalid user", { password: overCapFieldMessage(password.length, MAX_PASSWORD_LENGTH) });
  }
  const passwordHash = await hashPassword(password);
  await repo.updateUserPasswordHash(c.var.db, target.id, passwordHash);
  // Revoke every existing session for the target user so a stolen/shared
  // old password can't keep an active session alive (DEC-200 pattern).
  await repo.deleteUserSessions(c.var.db, target.id);

  return c.json({ id: target.id, email: target.email, role: target.role, password }, 200);
});

// DEC-778: role change becomes a real capability. Refuses loudly rather than
// silently no-op'ing: unknown role (400), target outside the caller's org
// (404, matches getOrgUserById's cross-org-hides-as-missing behavior), the
// caller targeting themselves (409 -- privilege changes are not self-service),
// and demoting the org's last remaining organizer (409, DEC-100 amendment
// wave 65: the refusal is now enforced atomically inside updateUserRole's
// WHERE, not by a count-then-write pre-check that two concurrent demotions
// of two different organizers could both slip past). Sessions are NOT
// revoked -- a role change is not a compromise.
usersRoutes.patch("/api/v1/users/:id", requireOrganizer, requireCookieSession, csrfJson, async (c) => {
  const auth = currentAuth(c);
  const userId = c.req.param("id");
  const record = await readJsonBody(c);
  const role = typeof record.role === "string" ? record.role : "";
  if (!isOrgUserRole(role)) {
    throw new ApiError("invalid", "role must be 'reviewer' or 'organizer'", { role: "invalid" });
  }

  const target = await repo.getOrgUserById(c.var.db, userId, auth.orgId);
  if (!target) throw new ApiError("not_found", "User not found");

  if (target.id === auth.userId) {
    throw new ApiError("conflict", "You cannot change your own role");
  }

  const updated = await repo.updateUserRole(c.var.db, target.id, auth.orgId, role);
  if (!updated) {
    throw new ApiError("conflict", "Cannot remove the organization's last organizer");
  }

  return c.json({ id: updated.id, email: updated.email, role: updated.role }, 200);
});
