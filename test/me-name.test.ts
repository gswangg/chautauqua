// DEC-576/DEC-757: GET /api/v1/me gains `name` (first + last from the
// signed-in user's linked contact via a leftJoin on user.contactId), else
// the stored user.name when non-blank, else the user's email — the header
// never renders null or 'undefined' for a real account.
// Mirrors test/api-route-composition.test.ts's technique: a stubbed db
// chain shaped like the real drizzle query the route awaits.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { meRoutes } from "../src/routes/me";

function buildApp(
  auth: AuthInfo,
  row: { email: string; userName: string | null; firstName: string | null; lastName: string | null } | undefined,
) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: async () => (row ? [row] : []),
            }),
          }),
        }),
      }),
    } as unknown as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", meRoutes);
  return app;
}

describe("GET /api/v1/me name field (DEC-576)", () => {
  it("returns name as 'First Last' when the user has a linked contact, even with a stored user.name (contact wins)", async () => {
    const auth: AuthInfo = { userId: "u-1", role: "organizer", orgId: "org-1" };
    const app = buildApp(auth, {
      email: "organizer@example.com",
      userName: "Ignored Name",
      firstName: "Jordan",
      lastName: "Alvarez",
    });

    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string | null; email: string };
    expect(body.name).toBe("Jordan Alvarez");
    expect(body.email).toBe("organizer@example.com");
  });

  it("returns the stored user.name when the user has no linked contact but a name (DEC-757)", async () => {
    const auth: AuthInfo = { userId: "u-2", role: "organizer", orgId: "org-1" };
    const app = buildApp(auth, {
      email: "organizer@example.com",
      userName: "Sam Rivera",
      firstName: null,
      lastName: null,
    });

    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string | null };
    expect(body.name).toBe("Sam Rivera");
  });

  it("returns the email when the user has neither a linked contact nor a stored name (DEC-757)", async () => {
    const auth: AuthInfo = { userId: "u-3", role: "organizer", orgId: "org-1" };
    const app = buildApp(auth, {
      email: "organizer@example.com",
      userName: null,
      firstName: null,
      lastName: null,
    });

    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string | null };
    expect(body.name).toBe("organizer@example.com");
  });

  it("401s (not a crash) when the user row itself can't be found", async () => {
    const auth: AuthInfo = { userId: "u-missing", role: "organizer", orgId: "org-1" };
    const app = buildApp(auth, undefined);

    const res = await app.request("/api/v1/me");
    expect(res.status).toBe(401);
  });
});
