// Regression for a w8-e out-of-area defect note (task-w8-e's commit body):
// GET /api/v1/contacts/:id (serializeContact in src/routes/api/contacts.ts)
// stored socialLinksJson (a speaker's portal-edited social links, written
// via src/server/repo/portal.ts) but never surfaced it in the response,
// even though bio round-tripped fine. Fixed by adding a `socialLinks`
// field to serializeContact's output, mirroring the existing
// `customFields` JSON-parse-or-null pattern immediately above it.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";

vi.mock("../src/server/repo/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>(
    "../src/server/repo/contacts",
  );
  return {
    ...actual,
    findContactForOrg: vi.fn(async () => ({
      id: "c-1",
      orgId: "org-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: null,
      company: null,
      title: null,
      bio: "Mathematician",
      headshotUrl: null,
      notes: null,
      customFieldsJson: null,
      socialLinksJson: JSON.stringify({ twitter: "https://twitter.com/ada" }),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })),
    getContactHistory: vi.fn(async () => []),
  };
});

const { contactsRoutes } = await import("../src/routes/api/contacts");

function buildApp(auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  app.route("/api/v1", contactsRoutes);
  return app;
}

describe("GET /api/v1/contacts/:id", () => {
  it("surfaces socialLinks alongside bio and customFields", async () => {
    const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: "org-1" };
    const app = buildApp(organizerAuth);

    const res = await app.request("/api/v1/contacts/c-1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bio: string; socialLinks: unknown };
    expect(body.bio).toBe("Mathematician");
    expect(body.socialLinks).toEqual({ twitter: "https://twitter.com/ada" });
  });

  it("returns null socialLinks when none stored", async () => {
    const { findContactForOrg } = await import("../src/server/repo/contacts");
    (findContactForOrg as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "c-2",
      orgId: "org-1",
      firstName: "Bea",
      lastName: "Byte",
      email: "bea@example.com",
      phone: null,
      company: null,
      title: null,
      bio: null,
      headshotUrl: null,
      notes: null,
      customFieldsJson: null,
      socialLinksJson: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    const organizerAuth: AuthInfo = { userId: "u-1", role: "organizer", orgId: "org-1" };
    const app = buildApp(organizerAuth);
    const res = await app.request("/api/v1/contacts/c-2");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { socialLinks: unknown };
    expect(body.socialLinks).toBeNull();
  });
});
