// DEC-065 regression coverage: GET /files/:fileId for task-assignment
// (kind='handout', submissionId null) uploads. Organizer org-match or the
// assigned speaker (assignment contact or uploader) may download; every
// other speaker and cross-org organizer get denied. Repo calls are mocked so
// these are pure route-level access-decision tests (no D1/wrangler
// dependency in stage 1) — same pattern as test/review-idor.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { canAccessTaskFile } from "../src/server/repo/files";

const ORG_A = "org-a";
const ORG_B = "org-b";

const taskFileScope = {
  fileId: "file-task-1",
  orgId: ORG_A,
  assignmentContactId: "contact-assigned",
  uploadedByContactId: null as string | null,
  filename: "handout.pdf",
  contentType: "application/pdf",
  r2Key: "task/file-task-1/handout.pdf",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileScope: vi.fn(async () => null),
    getResourceFileScope: vi.fn(async () => null),
    getTaskFileScope: vi.fn(async (_db: unknown, fileId: string) =>
      fileId === taskFileScope.fileId ? taskFileScope : null,
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
        httpMetadata: { contentType: taskFileScope.contentType },
        size: 10,
      };
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildApp(auth: AuthInfo) {
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

describe("canAccessTaskFile (pure DEC-065 authz check)", () => {
  it("allows the same-org organizer", () => {
    expect(canAccessTaskFile({ role: "organizer", orgId: ORG_A }, taskFileScope)).toBe(true);
  });

  it("denies a cross-org organizer", () => {
    expect(canAccessTaskFile({ role: "organizer", orgId: ORG_B }, taskFileScope)).toBe(false);
  });

  it("allows the assigned speaker", () => {
    expect(canAccessTaskFile({ role: "speaker", orgId: ORG_A, contactId: "contact-assigned" }, taskFileScope)).toBe(
      true,
    );
  });

  it("allows the uploader speaker even if not the assignment contact", () => {
    const scope = { ...taskFileScope, uploadedByContactId: "contact-uploader" };
    expect(canAccessTaskFile({ role: "speaker", orgId: ORG_A, contactId: "contact-uploader" }, scope)).toBe(true);
  });

  it("denies another speaker (IDOR)", () => {
    expect(canAccessTaskFile({ role: "speaker", orgId: ORG_A, contactId: "someone-else" }, taskFileScope)).toBe(
      false,
    );
  });

  it("denies reviewers", () => {
    expect(canAccessTaskFile({ role: "reviewer", orgId: ORG_A, contactId: "contact-assigned" }, taskFileScope)).toBe(
      false,
    );
  });
});

describe("DEC-065: GET /files/:fileId for task-assignment handout uploads", () => {
  it("200s for the same-org organizer", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("200s for the assigned speaker", async () => {
    const app = await buildApp({ userId: "u2", role: "speaker", orgId: ORG_A, contactId: "contact-assigned" });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("403s for another speaker (IDOR)", async () => {
    const app = await buildApp({ userId: "u3", role: "speaker", orgId: ORG_A, contactId: "contact-other" });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(403);
  });

  it("403s for a cross-org organizer", async () => {
    const app = await buildApp({ userId: "u4", role: "organizer", orgId: ORG_B });
    const res = await app.request(`/files/${taskFileScope.fileId}`);
    expect(res.status).toBe(403);
  });

  it("404s when no task_assignment references the file", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/unknown-file`);
    expect(res.status).toBe(404);
  });
});
