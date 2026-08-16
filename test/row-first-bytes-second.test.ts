// DEC-713 amendment (wave 50): "row first, bytes second." Both delete routes
// now commit the DB row delete BEFORE deleting the R2 object(s), because the
// two failure modes are not symmetric — a committed row pointing at missing
// bytes 404s forever and silently breaks SPEC's "history complete and
// downloadable" guarantee, while an object outliving its (never-committed)
// row is just an unreferenced blob, invisible and reclaimable. This file
// covers both edges for both routes:
//   - the bytes-side throws AFTER a successful row commit: the request must
//     still return its normal success envelope (a committed delete is never
//     reported as a failure), and the row(s) must actually be gone.
//   - the row-side (DB commit) throws: the bytes must be untouched (nothing
//     deleted) and the request must error.
// Enumerated over the full key set the plan named, never a sample.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { FileDeleteScope } from "../src/server/repo/files-versions";
import type { SubmissionDeletePlan } from "../src/server/repo/submission-delete";

// ---------------------------------------------------------------------------
// DELETE /api/v1/files/:fileId
// ---------------------------------------------------------------------------

const SCOPE: FileDeleteScope = {
  id: "mid-file",
  submissionId: "sub-1",
  eventId: "event-1",
  orgId: "org-1",
  filename: "deck-v2.pdf",
  r2Key: "sub/sub-1/mid-file-deck-v2.pdf",
  previousFileId: "old-file",
  uploadedByContactId: "contact-organizer-uploaded",
  contentStatus: "approved",
  status: "pending",
  formCloseDate: null,
  timezone: "UTC",
  isLatestInChain: false,
  assignmentContactId: null,
};

const ORGANIZER: AuthInfo = { userId: "org-user-1", role: "organizer", orgId: "org-1" };

function fakeFilesBucket(deleteImpl: (keys: string[]) => Promise<void>) {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete(keys: string | string[]) {
      await deleteImpl(Array.isArray(keys) ? keys : [keys]);
    },
  } as unknown as R2Bucket;
}

async function buildFileDeleteApp(auth: AuthInfo, files: R2Bucket) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: files } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

describe("DELETE /api/v1/files/:fileId — row first, bytes second (DEC-713 amendment, wave 50)", () => {
  it("still returns the success envelope, and commits the row delete, when the R2 delete throws after commit", async () => {
    vi.resetModules();
    const deletedVersionFileIds: string[] = [];
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      return {
        ...actual,
        getFileDeleteScope: vi.fn(async () => SCOPE),
        deleteFileVersion: vi.fn(async (_db: unknown, args: { fileId: string }) => {
          deletedVersionFileIds.push(args.fileId);
        }),
      };
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const files = fakeFilesBucket(async () => {
      throw new Error("R2 unavailable");
    });
    const app = await buildFileDeleteApp(ORGANIZER, files);

    const res = await app.request(`/api/v1/files/${SCOPE.id}`, {
      method: "DELETE",
      headers: { "x-chq-csrf": "1" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: SCOPE.id, deleted: true });
    // the row delete ran (and thus committed) despite the later R2 throw
    expect(deletedVersionFileIds).toEqual([SCOPE.id]);
    // the throw was logged, naming the file and the key, not swallowed silently
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg] = errorSpy.mock.calls[0]!;
    expect(String(msg)).toContain(SCOPE.id);
    expect(String(msg)).toContain(SCOPE.r2Key);

    errorSpy.mockRestore();
    vi.doUnmock("../src/server/repo/files");
    vi.resetModules();
  });

  it("leaves the R2 object untouched and errors the request when the row commit (deleteFileVersion) throws", async () => {
    vi.resetModules();
    const deleteCalls: string[][] = [];
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      return {
        ...actual,
        getFileDeleteScope: vi.fn(async () => SCOPE),
        deleteFileVersion: vi.fn(async () => {
          throw new Error("DB unavailable");
        }),
      };
    });

    const files = fakeFilesBucket(async (keys) => {
      deleteCalls.push(keys);
    });
    const app = await buildFileDeleteApp(ORGANIZER, files);

    const res = await app.request(`/api/v1/files/${SCOPE.id}`, {
      method: "DELETE",
      headers: { "x-chq-csrf": "1" },
    });

    expect(res.status).toBeGreaterThanOrEqual(500);
    // the R2 object was never touched — the row commit never happened
    expect(deleteCalls).toEqual([]);

    vi.doUnmock("../src/server/repo/files");
    vi.resetModules();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/events/:eventId/submissions/delete
// ---------------------------------------------------------------------------

const ELIGIBLE = [
  { submissionId: "s1", ref: "SES-001", title: "Talk 1", counts: emptyCounts(), scheduled: false, fileR2Keys: ["sub/s1/a.pdf", "sub/s1/b.pdf"] },
  { submissionId: "s2", ref: "SES-002", title: "Talk 2", counts: emptyCounts(), scheduled: false, fileR2Keys: ["sub/s2/a.pdf"] },
];

function emptyCounts() {
  return {
    files: 0,
    comments: 0,
    participants: 0,
    answers: 0,
    tracks: 0,
    recusals: 0,
    revisions: 0,
    taskResponses: 0,
    reviewAssignments: 0,
  };
}

const PLAN: SubmissionDeletePlan = { eligible: ELIGIBLE, refused: [] };
const ALL_KEYS = ELIGIBLE.flatMap((i) => i.fileR2Keys);

const SUB_ORGANIZER: AuthInfo = { userId: "org-user-1", role: "organizer", orgId: "org-1" };

function fakeSubmissionsFilesBucket(deleteImpl: (keys: string[]) => Promise<void>) {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete(keys: string | string[]) {
      await deleteImpl(Array.isArray(keys) ? keys : [keys]);
    },
  } as unknown as R2Bucket;
}

async function buildSubmissionsDeleteApp(auth: AuthInfo, files: R2Bucket) {
  const { submissionsRoutes } = await import("../src/routes/api/submissions");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: files } as never;
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

describe("POST /events/:eventId/submissions/delete — row first, bytes second (DEC-713 amendment, wave 50)", () => {
  it("still returns {deleted, refused}, and commits the row delete, when deleteMany throws after commit", async () => {
    vi.resetModules();
    let commitCalled = false;
    vi.doMock("../src/server/repo/submission-delete", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submission-delete")>(
        "../src/server/repo/submission-delete",
      );
      return {
        ...actual,
        planSubmissionDelete: vi.fn(async () => PLAN),
        commitSubmissionDelete: vi.fn(async () => {
          commitCalled = true;
          return ELIGIBLE.length;
        }),
      };
    });
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>("../src/server/repo/submissions");
      return { ...actual, getEventOrgId: vi.fn(async () => "org-1") };
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const files = fakeSubmissionsFilesBucket(async () => {
      throw new Error("R2 unavailable");
    });
    const app = await buildSubmissionsDeleteApp(SUB_ORGANIZER, files);

    const res = await app.request("/api/v1/events/event-1/submissions/delete", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["s1", "s2"] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: ELIGIBLE.length, refused: [] });
    expect(commitCalled).toBe(true);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg] = errorSpy.mock.calls[0]!;
    // names the event and the key count, per spec
    expect(String(msg)).toContain("event-1");
    expect(String(msg)).toContain(String(ALL_KEYS.length));

    errorSpy.mockRestore();
    vi.doUnmock("../src/server/repo/submission-delete");
    vi.doUnmock("../src/server/repo/submissions");
    vi.resetModules();
  });

  it("deletes zero R2 objects and errors the request when the DB commit throws", async () => {
    vi.resetModules();
    vi.doMock("../src/server/repo/submission-delete", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submission-delete")>(
        "../src/server/repo/submission-delete",
      );
      return {
        ...actual,
        planSubmissionDelete: vi.fn(async () => PLAN),
        commitSubmissionDelete: vi.fn(async () => {
          throw new Error("DB unavailable");
        }),
      };
    });
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>("../src/server/repo/submissions");
      return { ...actual, getEventOrgId: vi.fn(async () => "org-1") };
    });

    const deleteCalls: string[][] = [];
    const files = fakeSubmissionsFilesBucket(async (keys) => {
      deleteCalls.push(keys);
    });
    const app = await buildSubmissionsDeleteApp(SUB_ORGANIZER, files);

    const res = await app.request("/api/v1/events/event-1/submissions/delete", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ ids: ["s1", "s2"] }),
    });

    expect(res.status).toBeGreaterThanOrEqual(500);
    // every key the plan named — none of them were ever touched
    expect(deleteCalls).toEqual([]);

    vi.doUnmock("../src/server/repo/submission-delete");
    vi.doUnmock("../src/server/repo/submissions");
    vi.resetModules();
  });
});
