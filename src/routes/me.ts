// GET /api/v1/me bootstrap endpoint (DEC-018): lets the SPA role-gate nav
// and land reviewers on /review. Route file exports a named Hono sub-app;
// only src/index.ts mounts it (DEC-012).
//
// DEC-576: also returns `name` (first + last from the signed-in user's
// linked contact, or null if the user has no linked contact) so the header
// can render "J. ALVAREZ" instead of a bare email.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { ApiError } from "../server/http";
import * as schema from "../db/schema";

export const meRoutes = new Hono<AppEnv>();

meRoutes.get("/api/v1/me", async (c) => {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  const rows = await c.var.db
    .select({
      email: schema.user.email,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
    })
    .from(schema.user)
    .leftJoin(schema.contact, eq(schema.user.contactId, schema.contact.id))
    .where(eq(schema.user.id, auth.userId))
    .limit(1);
  const row = rows[0];
  const email = row?.email;
  if (!email) throw new ApiError("unauthorized", "Login required");

  const name = row.firstName && row.lastName ? `${row.firstName} ${row.lastName}` : null;

  return c.json({
    userId: auth.userId,
    email,
    name,
    role: auth.role,
    orgId: auth.orgId,
    ...(auth.contactId ? { contactId: auth.contactId } : {}),
  });
});
