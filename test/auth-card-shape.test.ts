// DEC-944/DEC-945 coverage: the auth surface family (login, claim,
// account/password, admin not-found) shares one card vocabulary — a single
// <main> landmark and exactly one <h1> per page, the frames' 640/520 card
// metrics in AUTH_CSS, and the demo-identity prefill block rendered as
// small links (not the 44px .chq-btn-secondary box) while keeping the
// .chq-auth-demo-btn hook DEMO_PREFILL_SCRIPT delegates on.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { registerNotFoundHandler } from "../src/server/not-found";
import { registerErrorHandler } from "../src/server/http";
import { sessionLoader } from "../src/server/middleware";
import { AUTH_CSS } from "../src/routes/auth.css";
import { DEMO_IDENTITIES } from "../src/lib/demo-identities";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";

function countTags(html: string, tag: string): number {
  const re = new RegExp(`<${tag}[ >]`, "g");
  return [...html.matchAll(re)].length;
}

function assertOneMainOneH1(html: string) {
  expect(countTags(html, "main")).toBe(1);
  expect(countTags(html, "h1")).toBe(1);
}

// DEC-740: the login door and the not-found page both query getHubOrg
// (orderBy().limit(), no where()) for single-event context — always
// resolves to no org here, keeping this suite about markup shape only.
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

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb());
    await next();
  });
  app.use("*", sessionLoader);
  registerErrorHandler(app);
  app.route("/", authRoutes);
  app.route("/", accountRoutes);
  registerNotFoundHandler(app);
  const env = { KV: { get: async () => null, put: async () => {}, delete: async () => {} } as unknown as AppEnv["Bindings"]["KV"] };
  return { app, env };
}

describe("auth surface card shape (DEC-944)", () => {
  it("GET /login renders exactly one <main> and one <h1>", async () => {
    const { app, env } = buildApp();
    const res = await app.request("/login", {}, env);
    expect(res.status).toBe(200);
    assertOneMainOneH1(await res.text());
  });

  it("GET /account/password (anonymous redirect aside) renders one <main>/<h1> when authenticated is out of scope — probe the 302 shape instead", async () => {
    const { app, env } = buildApp();
    const res = await app.request("/account/password", {}, env);
    // Anonymous visitors 302 to /login rather than rendering the card —
    // confirm the redirect, and separately confirm /login's shape above.
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("GET /claim/<bad-token> renders the expired-link card at 410 with exactly one <main>/<h1>", async () => {
    const { app, env } = buildApp();
    const res = await app.request("/claim/not-a-real-token", {}, env);
    expect(res.status).toBe(410);
    const html = await res.text();
    assertOneMainOneH1(html);
    expect(html).toContain("This link has expired");
    expect(html).toContain("Ask the organizer to send you a new portal invite.");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain("This link is invalid or has expired.");
  });

  it("app 404 (no route matched) renders exactly one <main> and one <h1>", async () => {
    const { app, env } = buildApp();
    const res = await app.request("/definitely-not-a-page", {}, env);
    expect(res.status).toBe(404);
    assertOneMainOneH1(await res.text());
  });
});

describe("AUTH_CSS card metrics (DEC-944/DEC-945)", () => {
  it("declares the frames' card, narrow-card, title and input numbers", () => {
    expect(AUTH_CSS).toContain("max-width: 640px");
    expect(AUTH_CSS).toContain("max-width: 520px");
    expect(AUTH_CSS).toContain("padding: 35px");
    expect(AUTH_CSS).toContain("max-width: 450px");
    expect(AUTH_CSS).toMatch(/\.chq-auth-title\s*\{[^}]*font-size:\s*28px/);
    expect(AUTH_CSS).toMatch(/input\[type=password\]\s*\{[^}]*min-height:\s*48px/);
  });
});

describe("demo-identity block renders small links, not .chq-btn-secondary (DEC-944)", () => {
  function fakeDbWithDemo(presentCount: number): Db {
    let calls = 0;
    return {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.org) {
            return { orderBy: () => ({ limit: async () => [] }) };
          }
          return {
            where: () => ({
              limit: async () => {
                const hit = calls < presentCount;
                calls++;
                return hit ? [{ id: "u" }] : [];
              },
            }),
          };
        },
      }),
    } as unknown as Db;
  }

  it("keeps .chq-auth-demo-btn + data-demo-* attributes but drops .chq-btn-secondary", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", fakeDbWithDemo(DEMO_IDENTITIES.length));
      await next();
    });
    app.route("/", authRoutes);
    registerErrorHandler(app);
    const res = await app.request("/login");
    const html = await res.text();

    const buttonMatches = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*data-demo-email/g)];
    expect(buttonMatches.length).toBe(DEMO_IDENTITIES.length);
    for (const match of buttonMatches) {
      const classAttr = match[1]!;
      expect(classAttr).toContain("chq-auth-demo-btn");
      expect(classAttr).not.toContain("chq-btn-secondary");
    }
    expect(html).toContain('type="button"');
  });
});
