// DEC-373/DEC-374: PUBLIC_CSS is inlined via dangerouslySetInnerHTML
// alongside THEME_CSS, and the per-event accent is validated + applied as a
// `style` attribute on <body> instead of being interpolated into CSS text.
// Mirrors the fake-db-chain harness established in test/public.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import { validAccent } from "../src/routes/public/shell";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeKv() {
  return {
    async get() {
      return null;
    },
    async put() {
      /* no-op */
    },
    async delete() {
      /* no-op */
    },
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

function buildApp(brandingJson: string | null) {
  const eventRow = {
    id: "ev1",
    orgId: "org1",
    name: "Test Event",
    slug: "conf",
    startDate: "2026-08-10",
    endDate: "2026-08-11",
    location: "Moscone West, San Francisco",
    timezone: "UTC",
    recordPrefix: "SES",
    brandingJson,
  };
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([eventRow]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      return makeChain([]); // hydrateSessions subRows (no sessions)
    },
    selectDistinct: () => makeChain([]), // getVisibleSubmissionIdsOrdered: no sessions
  };
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as any);
    await next();
  });
  app.route("/", publicRoutes);
  return app;
}

describe("validAccent (DEC-374 accent guard)", () => {
  it("passes through a valid 6-hex value unchanged", () => {
    expect(validAccent("#abc123")).toBe("#abc123");
  });

  it("rejects a non-hex value and falls back to the default accent", () => {
    expect(validAccent("red;background:url(x)")).toBe("#4E5C31");
    expect(validAccent("not-a-color")).toBe("#4E5C31");
    expect(validAccent(undefined)).toBe("#4E5C31");
  });
});

describe("PUBLIC_CSS rendering (DEC-373/374)", () => {
  it("a non-hex brandingJson accentColor falls back to the default accent on the body style attribute", async () => {
    installFakeCaches();
    const app = buildApp(JSON.stringify({ accentColor: "javascript:alert(1)" }));
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain("--chq-brandable-accent: #4E5C31;");
    expect(html).not.toContain("javascript:alert(1)");
  });

  it("no rendered <style> element contains HTML-escaped entities (&#39;/&quot;/&gt;)", async () => {
    installFakeCaches();
    const app = buildApp(JSON.stringify({ accentColor: "#123456" }));
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    expect(styleBlocks.length).toBeGreaterThan(0);
    for (const block of styleBlocks) {
      expect(block).not.toContain("&#39;");
      expect(block).not.toContain("&quot;");
      expect(block).not.toContain("&gt;");
    }
  });
});
