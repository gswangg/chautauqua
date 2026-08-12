// DEC-669 route-level coverage for GET /api/v1/events/:eventId/headshots:
// organizer-only, org-scoped, and — per the task spec — an eventId from
// another org 404s (never 403), unlike the sibling
// GET /api/v1/events/:eventId/files endpoint. Repo function mocked (route
// wiring under test, not the query itself — that's covered against a fake
// DB in test/files-headshots.test.ts).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getEventFilesScope: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === "event-1" ? { orgId: "org-1", slug: "demo-event" } : null,
    ),
    listEventHeadshotFiles: vi.fn(async () => ({
      items: [
        {
          fileId: "file-hs-1",
          filename: "priya.jpg",
          sizeBytes: 234567,
          contentType: "image/jpeg",
          createdAt: Date.now(),
          contactId: "contact-priya",
          contactName: "Priya Raman",
          company: "Acme Corp",
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
    })),
  };
});

async function buildHeadshotsApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };
const OTHER_ORG_ORGANIZER: AuthInfo = { userId: "u2", role: "organizer", orgId: "org-2" };
const SPEAKER: AuthInfo = { userId: "u3", role: "speaker", orgId: "org-1", contactId: "contact-1" };

describe("GET /api/v1/events/:eventId/headshots (DEC-669)", () => {
  it("returns the headshots list envelope for an organizer in the event's org", async () => {
    const app = await buildHeadshotsApp(ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/headshots", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; page: number; perPage: number };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ fileId: "file-hs-1", contactName: "Priya Raman", company: "Acme Corp" });
  });

  it("404s (never 403) an organizer from a different org — object-level ownership isn't disclosed", async () => {
    const app = await buildHeadshotsApp(OTHER_ORG_ORGANIZER);
    const res = await app.request("/api/v1/events/event-1/headshots", { method: "GET" });
    expect(res.status).toBe(404);
  });

  it("404s an unknown eventId", async () => {
    const app = await buildHeadshotsApp(ORGANIZER);
    const res = await app.request("/api/v1/events/unknown-event/headshots", { method: "GET" });
    expect(res.status).toBe(404);
  });

  it("403s a non-organizer (speaker) role", async () => {
    const app = await buildHeadshotsApp(SPEAKER);
    const res = await app.request("/api/v1/events/event-1/headshots", { method: "GET" });
    expect(res.status).toBe(403);
  });
});
