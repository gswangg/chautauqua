// DEC-462: manual session creation (POST /api/v1/events/:eventId/submissions)
// is the last unvalidated contact.email write. Mirrors
// test/email-validation.test.ts's mocking pattern (mock the repo function
// that would otherwise persist the email, capture what it was called with).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

function jsonPost(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

async function expectInvalid(res: Response, field: string) {
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error?: { code?: string; fields?: Record<string, string> } };
  expect(body.error?.code).toBe("invalid");
  expect(body.error?.fields).toHaveProperty(field);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("POST /api/v1/events/:eventId/submissions — DEC-462 contact.email validation", () => {
  it("rejects contact.email 'not-an-email' with a 400 and fields['contact.email']", async () => {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return { ...actual, getEventOrgId: vi.fn(async () => ORG_A) };
    });
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/submissions", {
        title: "A Talk",
        contact: { email: "not-an-email", firstName: "Jane", lastName: "Doe" },
      }),
    );
    await expectInvalid(res, "contact.email");
  });

  it("rejects a whitespace-only contact.email with a 400", async () => {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return { ...actual, getEventOrgId: vi.fn(async () => ORG_A) };
    });
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/submissions", {
        title: "A Talk",
        contact: { email: "   ", firstName: "Jane", lastName: "Doe" },
      }),
    );
    await expectInvalid(res, "contact.email");
  });

  it("persists 'Alice@Example.COM ' normalized as 'alice@example.com'", async () => {
    let capturedContact: { email: string; firstName: string; lastName: string } | null = null;
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return {
        ...actual,
        getEventOrgId: vi.fn(async () => ORG_A),
        createSubmission: vi.fn(
          async (
            _db: unknown,
            _eventId: string,
            _orgId: string,
            input: { contact: { email: string; firstName: string; lastName: string } | null },
          ) => {
            capturedContact = input.contact;
            return "sub-1";
          },
        ),
        getSubmissionDetail: vi.fn(async () => ({ id: "sub-1" })),
      };
    });
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const res = await app.request(
      jsonPost("/api/v1/events/ev-1/submissions", {
        title: "A Talk",
        contact: { email: "Alice@Example.COM ", firstName: "Alice", lastName: "Doe" },
      }),
    );
    expect(res.status).toBe(201);
    expect(capturedContact).toEqual({ email: "alice@example.com", firstName: "Alice", lastName: "Doe" });
  });
});
