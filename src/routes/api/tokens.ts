// GET/POST/DELETE /api/v1/tokens — DEC-027 bearer API token management.
// Cookie-session-only: a request authenticated via bearer token
// (auth.viaBearer) can never mint or manage tokens itself. Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { hashToken, newApiToken, apiTokenDisplayPrefix } from "../../auth/tokens";
import { DEC_027 } from "../../decisions";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-425

void DEC_027;

export const tokensRoutes = new Hono<AppEnv>();

function assertCookieSession(auth: { viaBearer?: boolean } | undefined): void {
  if (!auth) throw new ApiError("unauthorized", "Login required");
  if (auth.viaBearer) {
    throw new ApiError("forbidden", "API tokens cannot be managed with a bearer token");
  }
}

tokensRoutes.get("/api/v1/tokens", requireOrganizer, async (c) => {
  const auth = c.var.auth;
  assertCookieSession(auth);
  const orgId = auth!.orgId;

  const rows = await c.var.db
    .select({
      id: schema.apiToken.id,
      name: schema.apiToken.name,
      tokenPrefix: schema.apiToken.tokenPrefix,
      lastUsedAt: schema.apiToken.lastUsedAt,
    })
    .from(schema.apiToken)
    .where(eq(schema.apiToken.orgId, orgId))
    .orderBy(schema.apiToken.createdAt);

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      tokenPrefix: r.tokenPrefix,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.getTime() : null,
    })),
    total: rows.length,
    page: 1,
    perPage: rows.length,
  });
});

tokensRoutes.post("/api/v1/tokens", requireOrganizer, csrfJson, async (c) => {
  const auth = c.var.auth;
  assertCookieSession(auth);

  const body = await c.req.json().catch(() => null);
  const name = body && typeof body === "object" ? (body as Record<string, unknown>).name : undefined;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError("invalid", "name is required", { name: "required" });
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ApiError("invalid", "name is too long", { name: `Max ${MAX_NAME_LENGTH}` });
  }

  const plaintext = newApiToken();
  const tokenHash = await hashToken(plaintext);
  const now = new Date();

  await c.var.db.insert(schema.apiToken).values({
    id: newId(),
    orgId: auth!.orgId,
    name: name.trim(),
    tokenHash,
    tokenPrefix: apiTokenDisplayPrefix(plaintext),
    createdByUserId: auth!.userId,
    createdAt: now,
    updatedAt: now,
  });

  // The only place the plaintext token is ever returned — shown exactly
  // once (DEC-027).
  return c.json({ token: plaintext }, 201);
});

tokensRoutes.delete("/api/v1/tokens/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = c.var.auth;
  assertCookieSession(auth);
  const id = c.req.param("id");

  const rows = await c.var.db
    .select({ id: schema.apiToken.id, orgId: schema.apiToken.orgId })
    .from(schema.apiToken)
    .where(eq(schema.apiToken.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.orgId !== auth!.orgId) {
    throw new ApiError("not_found", "Token not found");
  }

  await c.var.db.delete(schema.apiToken).where(and(eq(schema.apiToken.id, id), eq(schema.apiToken.orgId, auth!.orgId)));
  return c.json({ ok: true });
});
