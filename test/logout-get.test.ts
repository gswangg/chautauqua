import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authRoutes, loginStatusLine } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

// DEC-154 (wave 25 amendment): /logout has no screen at all. GET /logout
// redirects to /login and never mutates anything (a bare GET side effect
// is a CSRF hole -- <img src="/logout"> would sign a producer out); POST
// keeps its CSRF guard + session delete and redirects to
// /login?signed-out=1, which the login card reads via loginStatusLine.
// The wave-8 LogoutConfirmPage is gone.
describe("GET /logout (DEC-154 wave-25 amendment)", () => {
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

  it("a signed-in visitor's bookmarked GET also just redirects to /login -- no confirmation screen, no session mutation", async () => {
    const app = buildApp({ userId: "u1", role: "organizer", orgId: "org1", contactId: undefined });
    const res = await app.request("/logout");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
    expect(res.headers.get("set-cookie") ?? "").not.toContain("chq_session=;");
  });
});

// Regression guard: the GET handler must not change POST /logout's
// behaviour -- it still ends the session and redirects to /login with the
// status query param the login card reads.
describe("POST /logout still works (regression guard)", () => {
  it("drops the session row and redirects to /login?signed-out=1", async () => {
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
    expect(res.headers.get("location")).toBe("/login?signed-out=1");
    expect(deleteCalled).toBe(true);
  });
});

describe("loginStatusLine (DEC-154 wave-25 amendment)", () => {
  it("returns the signed-out message for ?signed-out=1", () => {
    expect(loginStatusLine("https://example.com/login?signed-out=1")).toBe("You have been signed out.");
  });

  it("returns null for a bare /login URL", () => {
    expect(loginStatusLine("https://example.com/login")).toBeNull();
  });

  it("returns null for an unrecognized query string", () => {
    expect(loginStatusLine("https://example.com/login?foo=bar")).toBeNull();
  });
});
