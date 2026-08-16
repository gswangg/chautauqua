// GET /api/v1/me bootstrap endpoint (DEC-018): lets the SPA role-gate nav
// and land reviewers on /review. Route file exports a named Hono sub-app;
// only src/index.ts mounts it (DEC-012).
//
// DEC-576/DEC-757: also returns `name` — the signed-in user's linked
// contact's personName(firstName, lastName) (mononym-safe -- DEC-986 wave-5
// amendment, DEC-757) when present, else the stored user.name when
// non-blank, else the user's email — so the header can render "J. ALVAREZ"
// instead of a bare email, and staff without a linked contact still get a
// real name instead of null.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../server/env";
import { ApiError } from "../server/http";
import * as schema from "../db/schema";
import { personName } from "../domain/person-name";

export const meRoutes = new Hono<AppEnv>();

meRoutes.get("/api/v1/me", async (c) => {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  const rows = await c.var.db
    .select({
      email: schema.user.email,
      userName: schema.user.name,
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

  const name = personName(row) || (row.userName?.trim() ?? "") || email;

  return c.json({
    userId: auth.userId,
    email,
    name,
    role: auth.role,
    orgId: auth.orgId,
    ...(auth.contactId ? { contactId: auth.contactId } : {}),
  });
});
