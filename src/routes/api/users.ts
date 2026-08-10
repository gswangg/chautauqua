// Org user directory API (J4, DEC-043/DEC-044): organizer-only management
// of reviewer/organizer accounts. Route file exports a named Hono<AppEnv>
// sub-app; only src/index.ts mounts it (DEC-012/013).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { makeMailer } from "../../server/context";
import { textToHtml } from "../../mail/render";
import { hashPassword } from "../../auth/password";
import * as repo from "../../server/repo/users";
import { listEventsForOrg } from "../../server/repo/events";

export const usersRoutes = new Hono<AppEnv>();

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
  const email = typeof record.email === "string" ? record.email.trim() : "";
  if (email.length === 0) errors.email = "required";
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
    const mailer = makeMailer(c.var.db);
    const text = `An account has been created for you.\n\nEmail: ${created.email}\nTemporary password: ${password}\n\nPlease sign in and change your password.`;
    await mailer.send({
      to: { email: created.email, name: created.email },
      subject: "Your account has been created",
      text,
      html: textToHtml(text),
      eventId: anchorEventId,
      contactId: created.id,
    });
  }

  return c.json({ id: created.id, email: created.email, role: created.role, password }, 201);
});
