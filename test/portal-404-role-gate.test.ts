// DEC-945 (wave-6 amendment): path existence is decided before role
// redirection on the /portal/* shell, exactly as the /admin/* handler
// already does (src/routes/root.tsx) -- an unknown /portal path must
// answer the shared NotFoundDocument at HTTP 404 for every signed-in role,
// never invent a redirect into /admin. The speaker branch is untouched:
// an unmatched path for a speaker still falls through to whatever the
// mounted route table (+ registerNotFoundHandler) decides.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { portalRoutes } from "../src/routes/portal/index";
import { registerNotFoundHandler } from "../src/server/not-found";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import * as schema from "../src/db/schema";

// Same fakeDb shape test/login-demo-prefill.test.ts / test/auth-card-shape
// use: getHubOrg's org lookup (orderBy().limit(), no where()) always
// resolves to no org, so resolveNotFoundEyebrow falls back to "Not found".
function fakeDb(): Db {
  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === schema.org) {
          return { orderBy: () => ({ limit: async () => [] }) };
        }
        return { where: () => ({ limit: async () => [] }) };
      },
    }),
  } as unknown as Db;
}

function buildApp(auth?: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb());
    if (auth) c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalRoutes);
  registerNotFoundHandler(app);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "o1" };
const REVIEWER: AuthInfo = { userId: "u3", role: "reviewer", orgId: "o1" };
const SPEAKER: AuthInfo = { userId: "u2", role: "speaker", orgId: "o1", contactId: "c1" };

describe("/portal/* role gate + path existence (DEC-945 wave-6 amendment)", () => {
  it("an organizer at an unknown /portal path gets the 404 card at HTTP 404, never a redirect to /admin", async () => {
    const app = buildApp(ORGANIZER);
    const res = await app.request("/portal/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    const body = await res.text();
    expect(body).toContain("That page isn&#39;t here");
    expect(body).toContain("Overview");
    expect(body).toContain("Submissions");
  });

  it("a reviewer at an unknown /portal path also gets the 404 card, not a redirect", async () => {
    const app = buildApp(REVIEWER);
    const res = await app.request("/portal/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("an organizer at a REAL /portal path still redirects to /admin (role-wrong, path exists)", async () => {
    const app = buildApp(ORGANIZER);
    const res = await app.request("/portal");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
  });

  it("an organizer at /portal/submissions (a real portal path) still redirects to /admin", async () => {
    const app = buildApp(ORGANIZER);
    const res = await app.request("/portal/submissions");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
  });

  it("an anonymous request to any /portal path still redirects to /login (existence never leaked pre-auth)", async () => {
    const app = buildApp();
    const res = await app.request("/portal/nope");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("a speaker at an unknown /portal path still falls through to the app-level 404 (byte-identical, unchanged behaviour)", async () => {
    const app = buildApp(SPEAKER);
    const res = await app.request("/portal/nope");
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("That page isn&#39;t here");
  });
});
