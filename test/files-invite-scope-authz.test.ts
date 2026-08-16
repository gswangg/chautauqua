// DEC-317 route-level coverage for the files subsystem's read/write split
// (w50-a): an 'invited' participant is in the READ population (may see the
// submission and download its files while the invite is outstanding) but
// NOT the ACTIVE/write population (may not upload, comment, or delete a
// version); a 'declined' participant is in neither. Repo functions are
// mocked so this is pure route-authz-decision coverage, same pattern as
// test/files-delete-route.test.ts and test/reviewer-file-access.test.ts —
// canAccessFile is left un-mocked (vi.importActual) so the real pure
// predicate is exercised, not a stub.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { SubmissionScope, FileScope } from "../src/server/repo/files-authz";
import type { FileDeleteScope } from "../src/server/repo/files-versions";

const OPEN_SCOPE_FIELDS = { status: "pending", formCloseDate: null, timezone: "UTC" };

// sub-invited: contact-1's invite is outstanding — read yes, write no.
const INVITED_SUBMISSION_SCOPE: SubmissionScope = {
  submissionId: "sub-invited",
  eventId: "event-1",
  orgId: "org-1",
  readParticipantContactIds: ["contact-1"],
  activeParticipantContactIds: [],
  ...OPEN_SCOPE_FIELDS,
};

// sub-declined: contact-1 declined — excluded from both populations.
const DECLINED_SUBMISSION_SCOPE: SubmissionScope = {
  submissionId: "sub-declined",
  eventId: "event-1",
  orgId: "org-1",
  readParticipantContactIds: [],
  activeParticipantContactIds: [],
  ...OPEN_SCOPE_FIELDS,
};

const SUBMISSION_SCOPES: Record<string, SubmissionScope> = {
  "sub-invited": INVITED_SUBMISSION_SCOPE,
  "sub-declined": DECLINED_SUBMISSION_SCOPE,
};

// The file scope carries the same read/active lists, and an uploader who is
// NOT contact-1 — the DEC-713 delete route gates on uploadedByContactId, not
// participant lists, so contact-1 is refused there for being a non-uploader
// regardless of invite status (this route's own IDOR rule, untouched here).
function fileScopeFor(submissionId: string): FileScope {
  const sub = SUBMISSION_SCOPES[submissionId]!;
  return {
    fileId: "file-1",
    submissionId,
    eventId: sub.eventId,
    orgId: sub.orgId,
    uploadedByContactId: "contact-uploader",
    readParticipantContactIds: sub.readParticipantContactIds,
    activeParticipantContactIds: sub.activeParticipantContactIds,
    filename: "deck.pdf",
    contentType: "application/pdf",
    r2Key: "sub/sub-1/file-1-deck.pdf",
  };
}

function deleteScopeFor(submissionId: string): FileDeleteScope {
  const sub = SUBMISSION_SCOPES[submissionId]!;
  return {
    id: "file-1",
    submissionId,
    eventId: sub.eventId,
    orgId: sub.orgId,
    filename: "deck.pdf",
    r2Key: "sub/sub-1/file-1-deck.pdf",
    previousFileId: null,
    uploadedByContactId: "contact-uploader",
    contentStatus: "pending",
    status: sub.status,
    formCloseDate: sub.formCloseDate,
    timezone: sub.timezone,
    isLatestInChain: true,
    assignmentContactId: null,
  };
}

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) => SUBMISSION_SCOPES[submissionId] ?? null),
    getFileScope: vi.fn(async (_db: unknown, fileId: string) => (fileId === "file-1" ? fileScopeFor("sub-invited") : null)),
    // DEC-170 (wave-33 amendment): authzServeFile probes all three file
    // populations in one Promise.all wave instead of short-circuiting on the
    // first hit, so the serve path now reaches these two even when the
    // submission lookup matches. file-1 is a submission deliverable, so both
    // correctly return null — stubbed here because the un-mocked originals
    // would issue real D1 queries against this suite's stub db.
    getResourceFileScope: vi.fn(async () => null),
    getTaskFileScope: vi.fn(async () => null),
    getFileDeleteScope: vi.fn(async (_db: unknown, fileId: string) => (fileId === "file-1" ? deleteScopeFor("sub-invited") : null)),
    listSubmissionFiles: vi.fn(async () => ({})),
    batchContactNames: vi.fn(async () => new Map()),
    insertFile: vi.fn(async () => "new-file-id"),
    insertFileComment: vi.fn(async () => "new-comment-id"),
    reopenContentReview: vi.fn(async () => ({ reopened: false })),
    deleteFileVersion: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeFileStore: () => ({
      get: async () => ({ body: new ReadableStream(), httpMetadata: {} }),
      put: async () => {},
      delete: async () => {},
    }),
  };
});

const INVITED_SPEAKER: AuthInfo = { userId: "u1", role: "speaker", orgId: "org-1", contactId: "contact-1" };

async function makeApp(auth: AuthInfo) {
  const { fileApiRoutes, fileServeRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: {} } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  app.route("/", fileServeRoutes);
  return app;
}

describe("DEC-317 files read/write split — invite-status route matrix", () => {
  it("'invited' participant: 200 on GET submission files list", async () => {
    const app = await makeApp(INVITED_SPEAKER);
    const res = await app.request("/api/v1/submissions/sub-invited/files");
    expect(res.status).toBe(200);
  });

  it("'invited' participant: 200 on GET /files/:fileId (serve)", async () => {
    const app = await makeApp(INVITED_SPEAKER);
    const res = await app.request("/files/file-1");
    expect(res.status).toBe(200);
  });

  it("'invited' participant: 403 on POST submission files upload", async () => {
    const app = await makeApp(INVITED_SPEAKER);
    const form = new FormData();
    form.set("file", new File(["x"], "deck.pdf", { type: "application/pdf" }));
    form.set("kind", "presentation");
    const res = await app.request("/api/v1/submissions/sub-invited/files", {
      method: "POST",
      body: form,
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(403);
  });

  it("'invited' participant: 403 on POST a file comment", async () => {
    const app = await makeApp(INVITED_SPEAKER);
    const res = await app.request("/api/v1/files/file-1/comments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ body: "hello" }),
    });
    expect(res.status).toBe(403);
  });

  it("'invited' participant who did not upload the version: 403 on DELETE", async () => {
    const app = await makeApp(INVITED_SPEAKER);
    const res = await app.request("/api/v1/files/file-1", { method: "DELETE", headers: { "x-chq-csrf": "1" } });
    expect(res.status).toBe(403);
  });

  it("'declined' participant: 403 on GET submission files list", async () => {
    const app = await makeApp(INVITED_SPEAKER);
    const res = await app.request("/api/v1/submissions/sub-declined/files");
    expect(res.status).toBe(403);
  });

  it("'declined' participant: 403 on POST submission files upload", async () => {
    const app = await makeApp(INVITED_SPEAKER);
    const form = new FormData();
    form.set("file", new File(["x"], "deck.pdf", { type: "application/pdf" }));
    form.set("kind", "presentation");
    const res = await app.request("/api/v1/submissions/sub-declined/files", {
      method: "POST",
      body: form,
      headers: { "x-chq-csrf": "1" },
    });
    expect(res.status).toBe(403);
  });
});
