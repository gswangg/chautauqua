// DEC-066 regression coverage: reviewers may download a submission
// deliverable via GET /files/:fileId iff plan_reviewer-assigned to a review
// plan for the file's event — pure flag into canAccessFile, comment
// endpoints (GET/POST /api/v1/files/:fileId/comments) stay organizer/speaker
// only regardless of the flag. Repo calls are mocked so these are pure
// route-level access-decision tests (no D1/wrangler dependency in stage 1) —
// same pattern as test/review-idor.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { canAccessFile } from "../src/server/repo/files";

const ORG_A = "org-a";

const submissionFileScope = {
  fileId: "file-sub-1",
  submissionId: "sub-1",
  eventId: "event-1",
  orgId: ORG_A,
  uploadedByContactId: "contact-speaker",
  participantContactIds: ["contact-speaker"],
  filename: "slides.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-1/slides.pdf",
};

const ASSIGNED_REVIEWER = "rev-assigned";

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileScope: vi.fn(async (_db: unknown, fileId: string) =>
      fileId === submissionFileScope.fileId ? submissionFileScope : null,
    ),
    getResourceFileScope: vi.fn(async () => null),
    getTaskFileScope: vi.fn(async () => null),
    reviewerHasPlanForEvent: vi.fn(async (_db: unknown, userId: string, eventId: string) =>
      userId === ASSIGNED_REVIEWER && eventId === submissionFileScope.eventId,
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket() {
  return {
    async get() {
      return {
        body: new ReadableStream(),
        httpMetadata: { contentType: submissionFileScope.contentType },
        size: 10,
      };
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildServeApp(auth: AuthInfo) {
  const { fileServeRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/", fileServeRoutes);
  return app;
}

async function buildApiApp(auth: AuthInfo) {
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

describe("canAccessFile reviewer branch (DEC-066)", () => {
  it("allows a reviewer only when reviewerAssignedToEvent is explicitly true", () => {
    expect(
      canAccessFile(
        { role: "reviewer", orgId: ORG_A, contactId: "any" },
        submissionFileScope,
        { reviewerAssignedToEvent: true },
      ),
    ).toBe(true);
  });

  it("denies a reviewer when the flag is false", () => {
    expect(
      canAccessFile(
        { role: "reviewer", orgId: ORG_A, contactId: "any" },
        submissionFileScope,
        { reviewerAssignedToEvent: false },
      ),
    ).toBe(false);
  });

  it("denies a reviewer when opts is omitted entirely (no default-true)", () => {
    expect(canAccessFile({ role: "reviewer", orgId: ORG_A, contactId: "any" }, submissionFileScope)).toBe(false);
  });
});

describe("DEC-066: GET /files/:fileId for a submission deliverable, reviewer role", () => {
  it("200s for a reviewer assigned to a plan for the file's event", async () => {
    const app = await buildServeApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/files/${submissionFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("403s for a reviewer with no plan assignment for the file's event", async () => {
    const app = await buildServeApp({ userId: "rev-unassigned", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/files/${submissionFileScope.fileId}`);
    expect(res.status).toBe(403);
  });
});

describe("DEC-066: comment endpoints stay organizer/speaker-only regardless of reviewer plan assignment", () => {
  it("GET /api/v1/files/:fileId/comments 403s an assigned reviewer", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/${submissionFileScope.fileId}/comments`);
    expect(res.status).toBe(403);
  });

  it("POST /api/v1/files/:fileId/comments 403s an assigned reviewer", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/${submissionFileScope.fileId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ body: "hello" }),
    });
    expect(res.status).toBe(403);
  });
});
