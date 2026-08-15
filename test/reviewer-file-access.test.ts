// DEC-170 regression coverage (supersedes DEC-066; wave-54 amendment):
// reviewers may download a submission deliverable via GET /files/:fileId, AND
// read its comment thread via GET /api/v1/files/:fileId/comments, only when
// the file's submission is in scope for one of their NON-anonymized plan
// assignments — the SAME resolveReviewerFileScope predicate feeds both
// routes. POSTing a comment stays refused for every reviewer regardless of
// scope (a read predicate never authorizes a write). Repo calls are mocked so
// these are pure route-level access-decision tests (no D1/wrangler dependency
// in stage 1) — same pattern as test/review-idor.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { canAccessFile } from "../src/server/repo/files";

const ORG_A = "org-a";

// sub-1: reviewer "rev-assigned" is assigned to a NON-anonymized plan whose
// scope covers it -- in-scope, non-anonymized.
const inScopeFileScope = {
  fileId: "file-sub-1",
  submissionId: "sub-1",
  eventId: "event-1",
  orgId: ORG_A,
  uploadedByContactId: "contact-speaker",
  readParticipantContactIds: ["contact-speaker"],
  filename: "slides.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-1/slides.pdf",
};

// sub-2: same reviewer's plan assignment doesn't cover this submission (e.g.
// it's on a track the reviewer isn't assigned to) -- cross-track denial.
const crossTrackFileScope = {
  fileId: "file-sub-2",
  submissionId: "sub-2",
  eventId: "event-1",
  orgId: ORG_A,
  uploadedByContactId: "contact-speaker-2",
  readParticipantContactIds: ["contact-speaker-2"],
  filename: "deck.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-2/deck.pdf",
};

// sub-3: only reachable via an anonymized plan the reviewer is assigned to
// -- DEC-170 says anonymized plans never grant file access.
const anonymizedOnlyFileScope = {
  fileId: "file-sub-3",
  submissionId: "sub-3",
  eventId: "event-1",
  orgId: ORG_A,
  uploadedByContactId: "contact-speaker-3",
  readParticipantContactIds: ["contact-speaker-3"],
  filename: "notes.pdf",
  contentType: "application/pdf",
  r2Key: "sub/sub-3/notes.pdf",
};

const ASSIGNED_REVIEWER = "rev-assigned";

const scopesByFileId: Record<string, typeof inScopeFileScope> = {
  [inScopeFileScope.fileId]: inScopeFileScope,
  [crossTrackFileScope.fileId]: crossTrackFileScope,
  [anonymizedOnlyFileScope.fileId]: anonymizedOnlyFileScope,
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileScope: vi.fn(async (_db: unknown, fileId: string) => scopesByFileId[fileId] ?? null),
    getResourceFileScope: vi.fn(async () => null),
    getTaskFileScope: vi.fn(async () => null),
    // Mirrors reviewerCanAccessSubmissionFile's real contract: true only for
    // the assigned reviewer + the submission covered by their non-anonymized
    // plan. Cross-track and anonymized-only submissions never resolve true.
    reviewerCanAccessSubmissionFile: vi.fn(
      async (_db: unknown, userId: string, eventId: string, submissionId: string) =>
        userId === ASSIGNED_REVIEWER && eventId === "event-1" && submissionId === inScopeFileScope.submissionId,
    ),
    listFileComments: vi.fn(async () => ({ items: [], total: 0 })),
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
        httpMetadata: { contentType: "application/pdf" },
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

describe("canAccessFile reviewer branch (DEC-170)", () => {
  it("allows a reviewer only when reviewerInScope is explicitly true", () => {
    expect(
      canAccessFile({ role: "reviewer", orgId: ORG_A, contactId: "any" }, inScopeFileScope, { reviewerInScope: true }),
    ).toBe(true);
  });

  it("denies a reviewer when the flag is false", () => {
    expect(
      canAccessFile({ role: "reviewer", orgId: ORG_A, contactId: "any" }, inScopeFileScope, {
        reviewerInScope: false,
      }),
    ).toBe(false);
  });

  it("denies a reviewer when opts is omitted entirely (no default-true)", () => {
    expect(canAccessFile({ role: "reviewer", orgId: ORG_A, contactId: "any" }, inScopeFileScope)).toBe(false);
  });
});

describe("DEC-170: GET /files/:fileId for a submission deliverable, reviewer role", () => {
  it("200s for a reviewer whose non-anonymized plan assignment covers the file's submission", async () => {
    const app = await buildServeApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/files/${inScopeFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("403s for a cross-track submission's file (assigned reviewer, but scope doesn't cover it)", async () => {
    const app = await buildServeApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/files/${crossTrackFileScope.fileId}`);
    expect(res.status).toBe(403);
  });

  it("403s for a file covered only by an anonymized plan assignment", async () => {
    const app = await buildServeApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/files/${anonymizedOnlyFileScope.fileId}`);
    expect(res.status).toBe(403);
  });
});

describe("DEC-170: organizer and participant-speaker access unchanged", () => {
  it("200s for the org's organizer regardless of reviewer scoping", async () => {
    const app = await buildServeApp({ userId: "org-user", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/files/${inScopeFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("200s for the submission's participant speaker", async () => {
    const app = await buildServeApp({
      userId: "speaker-user",
      role: "speaker",
      orgId: ORG_A,
      contactId: "contact-speaker",
    });
    const res = await app.request(`/files/${inScopeFileScope.fileId}`);
    expect(res.status).toBe(200);
  });

  it("403s a speaker who isn't a participant on the submission (no IDOR)", async () => {
    const app = await buildServeApp({
      userId: "other-speaker-user",
      role: "speaker",
      orgId: ORG_A,
      contactId: "someone-else",
    });
    const res = await app.request(`/files/${inScopeFileScope.fileId}`);
    expect(res.status).toBe(403);
  });
});

// DEC-170 wave-54 amendment: the reviewer file grant is now reachable through
// the comment READ endpoint (GET) via the SAME resolveReviewerFileScope
// predicate GET /files/:fileId already used — a reviewer who can stream a
// file's bytes can also read its comment thread. The WRITE endpoint (POST)
// stays refused for every reviewer outright: a read predicate never
// authorizes a write (authzFileWrite).
describe("DEC-170 (wave 54): comment READ opens to an in-scope reviewer; WRITE stays refused", () => {
  it("GET /api/v1/files/:fileId/comments 200s an in-scope reviewer", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/${inScopeFileScope.fileId}/comments`);
    expect(res.status).toBe(200);
  });

  it("GET /api/v1/files/:fileId/comments 403s a cross-track reviewer", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/${crossTrackFileScope.fileId}/comments`);
    expect(res.status).toBe(403);
  });

  it("GET /api/v1/files/:fileId/comments 403s a reviewer whose only covering plan is anonymized", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/${anonymizedOnlyFileScope.fileId}/comments`);
    expect(res.status).toBe(403);
  });

  it("POST /api/v1/files/:fileId/comments 403s an in-scope reviewer — read grant never authorizes a write", async () => {
    const app = await buildApiApp({ userId: ASSIGNED_REVIEWER, role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/files/${inScopeFileScope.fileId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ body: "hello" }),
    });
    expect(res.status).toBe(403);
  });
});
