// DEC-583: /login's demo-credential prefill block must render if and only
// if every seeded demo account actually exists in this database, and it
// must NEVER auto-submit or post anywhere new. Modelled on the sub-app +
// fake-db style of test/root.test.ts: exercise authRoutes directly with an
// injected fake Db, no real D1/wrangler.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { authRoutes } from "../src/routes/auth";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";
import { DEMO_IDENTITIES } from "../src/lib/demo-identities";
import * as schema from "../src/db/schema";

// Simulates `presentCount` of the DEMO_IDENTITIES emails having a user row
// (demoIdentitiesPresent queries them in DEMO_IDENTITIES order, one
// eq()+limit(1) lookup per email, short-circuiting on the first miss).
//
// DEC-740: the login door also queries getHubOrg (orderBy().limit(), no
// where()) for its single-event subtitle/footer -- keyed off `table` so it
// never shares the demo lookups' `calls` counter, and always resolves to
// no org (subtitle/footer stay generic, which this suite doesn't assert on).
function fakeDb(presentCount: number): Db {
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

function buildApp(db: Db) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", authRoutes);
  registerErrorHandler(app);
  return app;
}

describe("GET /login demo-credential prefill (DEC-583)", () => {
  it("renders the demo block with all three prefill buttons when every seeded demo account exists", async () => {
    const app = buildApp(fakeDb(DEMO_IDENTITIES.length));
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const body = await res.text();

    for (const identity of DEMO_IDENTITIES) {
      // USER RULING (release night): the in-card presentation is restored --
      // sentence-case label, "Role · email" buttons in one wrapping row.
      const roleLabel = identity.role.charAt(0).toUpperCase() + identity.role.slice(1);
      expect(body).toContain(roleLabel);
      expect(body).toContain(identity.email);
      expect(body).toContain(`data-demo-email="${identity.email}"`);
      expect(body).toContain(`data-demo-password="${identity.password}"`);
    }
    expect(body).toContain("Try it with a seeded demo account");
    expect(body).not.toContain("Passwords come from the seed data.");
  });

  it("buttons carry no form action and never auto-submit", async () => {
    const app = buildApp(fakeDb(DEMO_IDENTITIES.length));
    const res = await app.request("/login");
    const body = await res.text();

    const buttonMatches = [...body.matchAll(/<button[^>]*class="[^"]*chq-auth-demo-btn[^"]*"[^>]*>/g)];
    expect(buttonMatches.length).toBe(DEMO_IDENTITIES.length);
    for (const match of buttonMatches) {
      const tag = match[0];
      expect(tag).toContain('type="button"');
      expect(tag).not.toContain("formaction");
      expect(tag).not.toContain(" action=");
    }
    // no client-side auto-submit anywhere in the page
    expect(body).not.toContain(".submit()");
    expect(body).not.toContain("requestSubmit");
  });

  it("renders nothing — no emails, no passwords, no demo block — when the seeded demo accounts do not exist", async () => {
    const app = buildApp(fakeDb(0));
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const body = await res.text();

    // The stylesheet (AUTH_CSS) always defines .chq-auth-demo* rules; only
    // the <body> markup reveals whether the block actually rendered.
    const bodyMarkup = body.slice(body.indexOf("<body>"));
    expect(bodyMarkup).not.toContain('class="chq-auth-demo"');
    expect(bodyMarkup).not.toContain("chq-auth-demo-btn");
    for (const identity of DEMO_IDENTITIES) {
      expect(body).not.toContain(identity.password);
      expect(body).not.toContain(identity.email);
      expect(body).not.toContain(identity.label);
    }
  });

  it("renders nothing when only some of the seeded demo accounts exist (partial match)", async () => {
    const app = buildApp(fakeDb(DEMO_IDENTITIES.length - 1));
    const res = await app.request("/login");
    const body = await res.text();

    // The stylesheet (AUTH_CSS) always defines .chq-auth-demo* rules; only
    // the <body> markup reveals whether the block actually rendered.
    const bodyMarkup = body.slice(body.indexOf("<body>"));
    expect(bodyMarkup).not.toContain('class="chq-auth-demo"');
    expect(bodyMarkup).not.toContain("chq-auth-demo-btn");
    for (const identity of DEMO_IDENTITIES) {
      expect(body).not.toContain(identity.password);
    }
  });
});
