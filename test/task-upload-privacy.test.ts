// DEC-549 regression coverage: a task upload is a session-deliverable
// (submission-linked) file ONLY when its task declared deliverable_kind at
// upload time. GET /files/:fileId for the two populations must answer
// identically on organizer/assignment-contact access, but diverge on
// co-participant / in-scope-reviewer access — those two only ever reach the
// file through its submission link (getFileScope's participantContactIds /
// reviewerCanAccessSubmissionFile), which a deliverable_kind-NULL task's
// upload never has (file.submissionId stays null, served only through the
// disjoint getTaskFileScope population — see files-authz.ts docblocks).
//
// Mirrors test/task-file-access.test.ts's route-level mocking pattern (repo
// calls mocked, no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const EVENT_1 = "event-1";
const SUBMISSION_1 = "submission-1";
const CONTACT_ASSIGNED = "contact-assigned";
const CONTACT_CO_PARTICIPANT = "contact-co-participant";
const REVIEWER_USER = "user-reviewer";

// --- deliverable_kind NULL population: file.submissionId is null, served
// only through getTaskFileScope (getFileScope returns null for it). ---
const nullKindTaskScope = {
  fileId: "file-null-kind",
  orgId: ORG_A,
  assignmentContactId: CONTACT_ASSIGNED,
  uploadedByContactId: CONTACT_ASSIGNED,
  filename: "handout.pdf",
  contentType: "application/pdf",
  r2Key: "task/file-null-kind/handout.pdf",
};

// --- deliverable_kind declared population: file.submissionId is set, served
// through getFileScope exactly like any other submission deliverable. ---
const declaredKindFileScope = {
  fileId: "file-declared-kind",
  submissionId: SUBMISSION_1,
  eventId: EVENT_1,
  orgId: ORG_A,
  uploadedByContactId: CONTACT_ASSIGNED,
  participantContactIds: [CONTACT_ASSIGNED, CONTACT_CO_PARTICIPANT],
  filename: "slides.pptx",
  contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  r2Key: "task/file-declared-kind/slides.pptx",
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileScope: vi.fn(async (_db: unknown, fileId: string) => {
      if (fileId === declaredKindFileScope.fileId) return declaredKindFileScope;
      return null;
    }),
    getResourceFileScope: vi.fn(async () => null),
    getTaskFileScope: vi.fn(async (_db: unknown, fileId: string) => {
      if (fileId === nullKindTaskScope.fileId) return nullKindTaskScope;
      return null;
    }),
    reviewerCanAccessSubmissionFile: vi.fn(async (_db: unknown, userId: string) => userId === REVIEWER_USER),
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
        httpMetadata: { contentType: "application/octet-stream" },
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

describe("DEC-549: GET /files/:fileId — deliverable_kind NULL task upload (no submission link)", () => {
  it("200s for the assignment's own contact", async () => {
    const app = await buildApp({ userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_ASSIGNED });
    const res = await app.request(`/files/${nullKindTaskScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("200s for an organizer in the same org", async () => {
    const app = await buildApp({ userId: "u2", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/${nullKindTaskScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("403s for a co-participant on the same submission (file never linked to it)", async () => {
    const app = await buildApp({
      userId: "u3",
      role: "speaker",
      orgId: ORG_A,
      contactId: CONTACT_CO_PARTICIPANT,
    });
    const res = await app.request(`/files/${nullKindTaskScope.fileId}`);
    expect(res.status).toBe(403);
  });

  it("403s for a reviewer with a non-anonymized in-scope plan assignment (task-scope authz denies all reviewers)", async () => {
    const app = await buildApp({ userId: REVIEWER_USER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/files/${nullKindTaskScope.fileId}`);
    expect(res.status).toBe(403);
  });
});

describe("DEC-549: GET /files/:fileId — deliverable_kind declared task upload (submission-linked, unchanged from today)", () => {
  it("200s for the assignment's own contact", async () => {
    const app = await buildApp({ userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_ASSIGNED });
    const res = await app.request(`/files/${declaredKindFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("200s for an organizer in the same org", async () => {
    const app = await buildApp({ userId: "u2", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/${declaredKindFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("200s for a co-participant on the same submission", async () => {
    const app = await buildApp({
      userId: "u3",
      role: "speaker",
      orgId: ORG_A,
      contactId: CONTACT_CO_PARTICIPANT,
    });
    const res = await app.request(`/files/${declaredKindFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("200s for a reviewer with a non-anonymized in-scope plan assignment", async () => {
    const app = await buildApp({ userId: REVIEWER_USER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/files/${declaredKindFileScope.fileId}`);
    expect(res.status).toBe(200);
  });
});
