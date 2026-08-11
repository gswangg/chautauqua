// DEC-322: publish speaker social links, safely. Covers safeExternalUrl's
// pure protocol allowlist plus the end-to-end route render: a safe https
// link renders with rel/target, an unsafe javascript: value is dropped
// entirely (never leaks into href or text), and an all-blank socialLinksJson
// renders no list markup at all.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { safeExternalUrl } from "../src/domain/contacts";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

describe("safeExternalUrl (DEC-322)", () => {
  it("returns null for empty input", () => {
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });

  it("returns null for a string that doesn't parse as a URL", () => {
    expect(safeExternalUrl("notaurl")).toBeNull();
  });

  it("returns null for a data: URL (disallowed protocol)", () => {
    expect(safeExternalUrl("data:text/html,x")).toBeNull();
  });

  it("returns null for a javascript: URL (disallowed protocol)", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
  });

  it("accepts an uppercase-scheme https URL, normalizing via URL#href", () => {
    expect(safeExternalUrl("HTTPS://x.test/a")).toBe("https://x.test/a");
  });
});

// ---------------------------------------------------------------------------
// Route-level rendering: fake-db-chain harness (mirrors test/public.test.ts).
// ---------------------------------------------------------------------------

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

const EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function speakerRow(socialLinksJson: string | null) {
  return {
    contactId: "contact1",
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Engineer",
    company: "Acme",
    bio: "A bio.",
    headshotUrl: null,
    socialLinksJson,
    submissionId: "sub1",
    submissionTitle: "A Talk",
  };
}

function buildApp(socialLinksJson: string | null) {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      // 1: getPublicEventBySlug
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      // 2: getPublicSpeakerDetail main rows
      if (selectCall === 2) return makeChain([speakerRow(socialLinksJson)]);
      // 3: getScheduleInfoForSubmissions slotRows
      if (selectCall === 3) return makeChain([]);
      // 4: trackRows
      return makeChain([]);
    },
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  installFakeCaches();
  return app.request("/e/conf/speakers/contact1", {}, TEST_ENV);
}

describe("speaker detail page social links (DEC-322)", () => {
  it("renders a safe https link with rel and target attributes", async () => {
    const res = await buildApp(JSON.stringify({ twitter: "", linkedin: "https://linkedin.com/in/ada", github: "", website: "" }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('href="https://linkedin.com/in/ada"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it("drops a stored javascript: value entirely — nowhere in the HTML, as href or text", async () => {
    const res = await buildApp(JSON.stringify({ twitter: "javascript:alert(1)", linkedin: "", github: "", website: "" }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("javascript:alert(1)");
    expect(html).not.toContain("javascript:");
  });

  it("renders no list markup at all when every social field is blank", async () => {
    const res = await buildApp(JSON.stringify({ twitter: "", linkedin: "", github: "", website: "" }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("noopener noreferrer nofollow");
  });
});
