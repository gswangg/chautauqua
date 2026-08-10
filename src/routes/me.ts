// GET /api/v1/me bootstrap endpoint (DEC-018): lets the SPA role-gate nav
// and land reviewers on /review. Route file exports a named Hono sub-app;
// only src/index.ts mounts it (DEC-012).

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
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, auth.userId))
    .limit(1);
  const email = rows[0]?.email;
  if (!email) throw new ApiError("unauthorized", "Login required");

  return c.json({
    userId: auth.userId,
    email,
    role: auth.role,
    orgId: auth.orgId,
    ...(auth.contactId ? { contactId: auth.contactId } : {}),
  });
});
