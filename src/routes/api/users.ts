// Org user directory API (J4, DEC-043/DEC-044): organizer-only management
// of reviewer/organizer accounts. Route file exports a named Hono<AppEnv>
// sub-app; only src/index.ts mounts it (DEC-012/013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { makeMailer } from "../../server/context";
import { textToHtml } from "../../mail/render";
import { hashPassword } from "../../auth/password";
import * as repo from "../../server/repo/users";
import { listEventsForOrg } from "../../server/repo/events";
import { DEC_239 } from "../../decisions";

export const usersRoutes = new Hono<AppEnv>();
void DEC_239; // GET /api/v1/users items must retain {id,email,role,...} -- the SPA's ReviewerOption keys on `id`, not `userId`

const ALLOWED_ROLES = new Set(["reviewer", "organizer"]);

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
  if (role !== undefined && !ALLOWED_ROLES.has(role)) {
    throw new ApiError("invalid", "role must be 'reviewer' or 'organizer'", { role: "invalid" });
  }
  const items = await repo.listOrgUsers(c.var.db, auth.orgId, role);
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1 });
});

usersRoutes.post("/api/v1/users", requireOrganizer, csrfJson, async (c) => {
  const auth = currentAuth(c);
  const body = await c.req.json().catch(() => null);
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const errors: Record<string, string> = {};
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (email.length === 0) errors.email = "required";
  else if (email.length > MAX_NAME_LENGTH) errors.email = `Max ${MAX_NAME_LENGTH}`; // DEC-417
  const role = typeof record.role === "string" ? record.role : "";
  if (!ALLOWED_ROLES.has(role)) errors.role = "must be 'reviewer' or 'organizer'";
  if (Object.keys(errors).length > 0) {
    throw new ApiError("invalid", "Invalid user", errors);
  }

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const created = await repo.createUser(c.var.db, { orgId: auth.orgId, email, role, passwordHash });

  // email_log.event_id is NOT NULL (DEC-006); org user accounts aren't
  // event-scoped, so the welcome email is logged against the org's first
  // event when one exists. A brand-new org with zero events still gets the
  // account + one-time password in the response — no design doc covers this
  // gap, so we take the narrowest reading: no event, no email row, but the
  // account still works. Flagged for the scribe.
  const orgEvents = await listEventsForOrg(c.var.db, auth.orgId);
  const anchorEventId = orgEvents[0]?.id;
  if (anchorEventId) {
    // DEC-238: user creation must succeed even if the best-effort welcome
    // notice fails to send (the account, password, and response body are
    // already valid) — catch, log, and continue rather than surfacing a 500
    // for a side-effect email.
    try {
      const mailer = makeMailer(c.var.db, c.env);
      const text = `An account has been created for you.\n\nEmail: ${created.email}\n\nSign in at /login with the temporary password your organizer will share with you; you can change it at /account/password after signing in.`;
      await mailer.send({
        to: { email: created.email, name: created.email },
        subject: "Your account has been created",
        text,
        html: textToHtml(text),
        eventId: anchorEventId,
        // DEC-191: this user is not a contact; per-contact email history
        // intentionally excludes rows like this one.
        contactId: null,
      });
    } catch (err) {
      console.error("account-creation welcome email failed (account still created):", err);
    }
  }

  return c.json({ id: created.id, email: created.email, role: created.role, password }, 201);
});

// DEC-215: organizer-triggered password re-issue for an org user (reviewer
// or organizer). The fresh one-time password is returned ONLY in this JSON
// response body — never emailed (DEC-200/DEC-043 pattern: passwords never
// travel over email, only the account-creation notice does, and that notice
// omits the password too). The organizer is responsible for relaying it to
// the user out of band.
usersRoutes.post("/api/v1/users/:id/reset-password", requireOrganizer, csrfJson, async (c) => {
  const auth = currentAuth(c);
  const userId = c.req.param("id");
  const target = await repo.getOrgUserById(c.var.db, userId, auth.orgId);
  if (!target) throw new ApiError("not_found", "User not found");

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await repo.updateUserPasswordHash(c.var.db, target.id, passwordHash);
  // Revoke every existing session for the target user so a stolen/shared
  // old password can't keep an active session alive (DEC-200 pattern).
  await repo.deleteUserSessions(c.var.db, target.id);

  return c.json({ id: target.id, email: target.email, role: target.role, password }, 200);
});
