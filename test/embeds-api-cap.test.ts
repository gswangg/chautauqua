// DEC-822: POST /api/v1/events/:eventId/embeds refuses at
// MAX_SAVED_EMBEDS_PER_EVENT (src/domain/embeds.ts) -- an event-wide cap,
// since a saved embed has no per-organiser ownership (unlike saved views,
// whose cap counts only the caller's own rows). Mocks the repo layer
// directly (countEmbeds/createEmbed/getEventOrgId) rather than a fake db
// chain, since the POST path crosses two repo modules.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_SAVED_EMBEDS_PER_EVENT } from "../src/domain/embeds";

const ORG_A = "org-a";
const EVENT_ID = "event-1";

let embedCount = 0;
let createdCount = 0;

vi.mock("../src/server/repo/submissions", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>("../src/server/repo/submissions");
  return {
    ...actual,
    getEventOrgId: vi.fn(async () => ORG_A),
  };
});

vi.mock("../src/server/repo/embeds", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/embeds")>("../src/server/repo/embeds");
  return {
    ...actual,
    countEmbeds: vi.fn(async () => embedCount),
    createEmbed: vi.fn(async (_db: unknown, orgId: string, eventId: string, name: string, surface: string, format: string, optionsJson: string) => {
      createdCount += 1;
      return {
        id: "emb-new",
        orgId,
        eventId,
        name,
        surface,
        format,
        optionsJson,
        enabled: true,
        createdAt: new Date(1),
        updatedAt: new Date(1),
      };
    }),
  };
});

import { embedsRoutes } from "../src/routes/api/embeds";

const ORGANIZER_A: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_A };

function appWithAuth(auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", embedsRoutes);
  return app;
}

function postRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function patchRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/events/:eventId/embeds (DEC-822 cap)", () => {
  it("refuses at the cap, naming the limit, and writes no row", async () => {
    embedCount = MAX_SAVED_EMBEDS_PER_EVENT;
    createdCount = 0;
    const app = appWithAuth(ORGANIZER_A);

    const res = await app.request(
      postRequest(`/api/v1/events/${EVENT_ID}/embeds`, {
        name: "Widget",
        surface: "sessions",
        format: "iframe",
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("invalid");
    expect(body.error.message).toContain(String(MAX_SAVED_EMBEDS_PER_EVENT));
    expect(body.error.fields).toMatchObject({ name: expect.any(String) });
    expect(createdCount).toBe(0);
  });

  it("still creates and 201s one under the cap", async () => {
    embedCount = MAX_SAVED_EMBEDS_PER_EVENT - 1;
    createdCount = 0;
    const app = appWithAuth(ORGANIZER_A);

    const res = await app.request(
      postRequest(`/api/v1/events/${EVENT_ID}/embeds`, {
        name: "Widget",
        surface: "sessions",
        format: "iframe",
      }),
    );

    expect(res.status).toBe(201);
    expect(createdCount).toBe(1);
  });
});

describe("PATCH /api/v1/embeds/:id at the cap (DEC-822)", () => {
  it("still succeeds -- PATCH never adds a row, so the cap does not apply", async () => {
    embedCount = MAX_SAVED_EMBEDS_PER_EVENT;

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    const EMBED_ROW = {
      id: "emb-1",
      orgId: ORG_A,
      eventId: EVENT_ID,
      name: "Homepage widget",
      surface: "sessions",
      format: "iframe",
      optionsJson: "{}",
      enabled: true,
      createdAt: new Date(1000),
      updatedAt: new Date(1000),
    };
    const repo = await import("../src/server/repo/embeds");
    vi.spyOn(repo, "getEmbedOwnership").mockResolvedValue({ orgId: ORG_A, eventId: EVENT_ID, surface: "sessions", options: {} });
    vi.spyOn(repo, "updateEmbed").mockResolvedValue({ ...EMBED_ROW, name: "Renamed" } as any);

    app.use("*", async (c, next) => {
      c.set("db", {} as AppEnv["Variables"]["db"]);
      c.set("auth", ORGANIZER_A);
      await next();
    });
    app.route("/api/v1", embedsRoutes);

    const res = await app.request(patchRequest("/api/v1/embeds/emb-1", { name: "Renamed" }));

    expect(res.status).toBe(200);
  });
});
