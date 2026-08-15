// DEC-322 wave-30 amendment: gate the brand logo URL before it becomes an
// <img src>. Covers the pure src/domain/brand-url.ts contract, the two
// write doors (events.ts branding.logoUrl, portal-config.ts logoUrl), and a
// render assertion that a legacy unsafe stored value never reaches the DOM.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { safeImageSrc } from "../src/domain/brand-url";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-brand";
const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

function jsonReq(path: string, body: unknown, method = "POST") {
  return new Request(`http://local${path}`, {
    method,
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Pure contract
// ---------------------------------------------------------------------------

describe("safeImageSrc", () => {
  const cases: Array<[string | null | undefined, string | null]> = [
    [null, null],
    [undefined, null],
    ["", null],
    ["   ", null],
    ["https://x.test/l.png", "https://x.test/l.png"],
    ["http://x.test/l.png", "http://x.test/l.png"],
    ["  https://x.test/l.png  ", "https://x.test/l.png"],
    ["/files/logo.png", "/files/logo.png"],
    ["//evil.example/x", null],
    ["javascript:alert(1)", null],
    ["data:image/png;base64,AAAA", null],
    ["mailto:a@b.com", null],
    ["notaurl", null],
    ["/has\tcontrol", null],
    ["/has\ncontrol", null],
  ];

  it.each(cases)("safeImageSrc(%j) -> %j", (input, expected) => {
    expect(safeImageSrc(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Write door: src/routes/api/events.ts parseBranding
// ---------------------------------------------------------------------------

const existingEvent = {
  id: "event-brand",
  orgId: ORG_A,
  name: "Brand Event",
  slug: "brand-event",
  startDate: "2026-06-01",
  endDate: "2026-06-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "EV",
  branding: null,
  createdAt: 0,
  updatedAt: 0,
};

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("src/routes/api/events.ts branding.logoUrl gate", () => {
  async function buildApp() {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return {
        ...actual,
        isSlugTaken: vi.fn(async () => false),
        getEventForOrg: vi.fn(async () => existingEvent),
        updateEvent: vi.fn(async (_db: unknown, _eventId: string, _orgId: string, patch: Record<string, unknown>) => {
          const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
          return { ...existingEvent, ...defined };
        }),
      };
    });
    vi.doMock("../src/server/repo/agenda", () => ({
      listSlotsOutsideWindow: vi.fn(async () => ({ count: 0, sessions: [] })),
    }));
    vi.doMock("../src/server/repo/breaks", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/breaks")>("../src/server/repo/breaks");
      return { ...actual, listBreaksOutsideWindow: vi.fn(async () => ({ count: 0, breaks: [] })) };
    });
    const { eventsRoutes } = await import("../src/routes/api/events");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", eventsRoutes);
    return app;
  }

  it("rejects a javascript: logoUrl with a field error", async () => {
    const app = await buildApp();
    const res = await app.request(
      jsonReq(`/api/v1/events/${existingEvent.id}`, { branding: { logoUrl: "javascript:alert(1)" } }, "PATCH"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { fields?: Record<string, string> } };
    expect(body.error?.fields).toHaveProperty("branding.logoUrl");
  });

  it("rejects a protocol-relative //evil.example/logo.png with a field error", async () => {
    const app = await buildApp();
    const res = await app.request(
      jsonReq(`/api/v1/events/${existingEvent.id}`, { branding: { logoUrl: "//evil.example/logo.png" } }, "PATCH"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { fields?: Record<string, string> } };
    expect(body.error?.fields).toHaveProperty("branding.logoUrl");
  });

  it("accepts an absolute https logoUrl", async () => {
    const app = await buildApp();
    const res = await app.request(
      jsonReq(`/api/v1/events/${existingEvent.id}`, { branding: { logoUrl: "https://x.test/l.png" } }, "PATCH"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { branding: { logoUrl: string } };
    expect(body.branding.logoUrl).toBe("https://x.test/l.png");
  });

  it("accepts a root-relative /files/logo.png logoUrl", async () => {
    const app = await buildApp();
    const res = await app.request(
      jsonReq(`/api/v1/events/${existingEvent.id}`, { branding: { logoUrl: "/files/logo.png" } }, "PATCH"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { branding: { logoUrl: string } };
    expect(body.branding.logoUrl).toBe("/files/logo.png");
  });
});

// ---------------------------------------------------------------------------
// Write door: src/routes/api/portal-config.ts PUT portal-settings
// ---------------------------------------------------------------------------

describe("src/routes/api/portal-config.ts logoUrl gate", () => {
  async function buildApp() {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return { ...actual, getEventForOrg: vi.fn(async () => ({ id: "ev-1", orgId: ORG_A })) };
    });
    vi.doMock("../src/server/repo/portal-config", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal-config")>(
        "../src/server/repo/portal-config",
      );
      return {
        ...actual,
        upsertPortalSettings: vi.fn(async (_db: unknown, eventId: string, input: Record<string, unknown>) => ({
          id: "ps-1",
          eventId,
          logoUrl: (input.logoUrl as string | null | undefined) ?? null,
          accentColor: null,
          welcomeMessage: null,
          showResources: true,
          createdAt: 0,
          updatedAt: 0,
        })),
      };
    });
    const { portalConfigRoutes } = await import("../src/routes/api/portal-config");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", portalConfigRoutes);
    return app;
  }

  it("rejects a javascript: logoUrl with a field error", async () => {
    const app = await buildApp();
    const res = await app.request(
      jsonReq("/api/v1/events/ev-1/portal-settings", { logoUrl: "javascript:alert(1)" }, "PUT"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { fields?: Record<string, string> } };
    expect(body.error?.fields).toHaveProperty("logoUrl");
  });

  it("rejects a protocol-relative //evil.example/logo.png with a field error", async () => {
    const app = await buildApp();
    const res = await app.request(
      jsonReq("/api/v1/events/ev-1/portal-settings", { logoUrl: "//evil.example/logo.png" }, "PUT"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { fields?: Record<string, string> } };
    expect(body.error?.fields).toHaveProperty("logoUrl");
  });

  it("accepts an absolute https logoUrl", async () => {
    const app = await buildApp();
    const res = await app.request(
      jsonReq("/api/v1/events/ev-1/portal-settings", { logoUrl: "https://x.test/l.png" }, "PUT"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { logoUrl: string };
    expect(body.logoUrl).toBe("https://x.test/l.png");
  });

  it("accepts a root-relative /files/logo.png logoUrl", async () => {
    const app = await buildApp();
    const res = await app.request(
      jsonReq("/api/v1/events/ev-1/portal-settings", { logoUrl: "/files/logo.png" }, "PUT"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { logoUrl: string };
    expect(body.logoUrl).toBe("/files/logo.png");
  });
});

// ---------------------------------------------------------------------------
// Read door: a legacy unsafe stored logo value never reaches the public
// shell's <img src>.
// ---------------------------------------------------------------------------

describe("public shell branding() sanitizes a legacy unsafe stored logoUrl", () => {
  it("drops javascript: so no img src is produced", async () => {
    const { branding } = await import("../src/routes/public/shell");
    const event = {
      id: "ev-1",
      brandingJson: JSON.stringify({ logoUrl: "javascript:alert(1)", accentColor: "#336699" }),
    } as unknown as Parameters<typeof branding>[0];
    const result = branding(event);
    expect(result.logoUrl).toBeUndefined();
  });

  it("passes through a safe https logoUrl", async () => {
    const { branding } = await import("../src/routes/public/shell");
    const event = {
      id: "ev-1",
      brandingJson: JSON.stringify({ logoUrl: "https://x.test/l.png" }),
    } as unknown as Parameters<typeof branding>[0];
    const result = branding(event);
    expect(result.logoUrl).toBe("https://x.test/l.png");
  });
});
