import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

// DEC-154 amendment (wave 8): a typed/bookmarked GET /logout must render a
// real confirmation page rather than 404ing, and never itself end the
// session (only the POST does that).
describe("GET /logout (DEC-154 amendment, wave 8)", () => {
  function buildApp(auth?: AppEnv["Variables"]["auth"]) {
    const db = {
      delete() {
        return {
          where() {
            throw new Error("GET /logout must never delete the session");
          },
        };
      },
    } as unknown as AppEnv["Variables"]["db"];
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      if (auth) c.set("auth", auth);
      await next();
    });
    app.route("/", authRoutes);
    return app;
  }

  it("anonymous visitor is redirected straight to /login (nothing to end)", async () => {
    const app = buildApp(undefined);
    const res = await app.request("/logout");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("organizer sees a confirmation page with a POST /logout form carrying the CSRF token, and the session cookie is not cleared", async () => {
    const app = buildApp({ userId: "u1", role: "organizer", orgId: "org1", contactId: undefined });
    const res = await app.request("/logout");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('action="/logout"');
    expect(body).toContain('method="post"');
    expect(body).toMatch(/<input type="hidden" name="chq_csrf" value="[^"]+"/);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("chq_session=;");
  });

  it("speaker's 'Stay signed in' link points at /portal", async () => {
    const app = buildApp({ userId: "u2", role: "speaker", orgId: "org1", contactId: "c1" });
    const res = await app.request("/logout");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('href="/portal"');
    expect(body).toContain("Stay signed in");
  });

  it("organizer's 'Stay signed in' link points at /admin", async () => {
    const app = buildApp({ userId: "u1", role: "organizer", orgId: "org1", contactId: undefined });
    const res = await app.request("/logout");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('href="/admin"');
  });
});

// Regression guard: the GET handler must not change POST /logout's
// behaviour -- it still ends the session and redirects to /login.
describe("POST /logout still works (regression guard)", () => {
  it("drops the session row and redirects to /login", async () => {
    let deleteCalled = false;
    const db = {
      delete() {
        return {
          where() {
            deleteCalled = true;
            return Promise.resolve();
          },
        };
      },
    } as unknown as AppEnv["Variables"]["db"];
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);

    const res = await app.request("/logout", {
      method: "POST",
      headers: {
        cookie: "chq_session=session-tok-abc",
        "x-chq-csrf": "1",
      },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
    expect(deleteCalled).toBe(true);
  });
});
