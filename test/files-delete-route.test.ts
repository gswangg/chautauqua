// DEC-713 route-level coverage for DELETE /api/v1/files/:fileId: organizer
// vs speaker authz (latest-only, own-upload-only, pending-only for
// speakers), and that the R2 object is deleted through the same store
// abstraction (makeFileStore) using the file's own r2Key before the DB
// write runs. Repo functions are mocked (route wiring under test, not repo
// logic — repo logic covered against a fake DB in
// test/files-delete.test.ts), mirroring test/files-archive-route.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { FileDeleteScope } from "../src/server/repo/files-versions";

const SCOPES: Record<string, FileDeleteScope> = {
  // organizer may delete ANY version.
  "mid-file": {
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
  },
  // speaker's own latest version, submission still pending — deletable by them.
  "latest-file": {
    id: "latest-file",
    submissionId: "sub-1",
    eventId: "event-1",
    orgId: "org-1",
    filename: "deck-v3.pdf",
    r2Key: "sub/sub-1/latest-file-deck-v3.pdf",
    previousFileId: "mid-file",
    uploadedByContactId: "contact-speaker",
    contentStatus: "pending",
    status: "pending",
    formCloseDate: null,
    timezone: "UTC",
    isLatestInChain: true,
    assignmentContactId: null,
  },
  // same speaker's own version, but NOT the latest link in the chain.
  "not-latest-file": {
    id: "not-latest-file",
    submissionId: "sub-1",
    eventId: "event-1",
    orgId: "org-1",
    filename: "deck-v1.pdf",
    r2Key: "sub/sub-1/not-latest-file-deck-v1.pdf",
    previousFileId: null,
    uploadedByContactId: "contact-speaker",
    contentStatus: "pending",
    status: "pending",
    formCloseDate: null,
    timezone: "UTC",
    isLatestInChain: false,
    assignmentContactId: null,
  },
  // speaker's own latest version, but the submission has moved past pending.
  "approved-latest-file": {
    id: "approved-latest-file",
    submissionId: "sub-1",
    eventId: "event-1",
    orgId: "org-1",
    filename: "deck-final.pdf",
    r2Key: "sub/sub-1/approved-latest-file-deck-final.pdf",
    previousFileId: "old-file",
    uploadedByContactId: "contact-speaker",
    contentStatus: "approved",
    status: "pending",
    formCloseDate: null,
    timezone: "UTC",
    isLatestInChain: true,
    assignmentContactId: null,
  },
};

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileDeleteScope: vi.fn(async (_db: unknown, fileId: string) => SCOPES[fileId] ?? null),
    deleteFileVersion: vi.fn(async () => {}),
  };
});

function fakeFilesBucket(deleteSpy: (key: string) => void) {
  return {
    async get() {
      return null;
    },
    async put() {},
    // FileStore.delete delegates to deleteMany (src/server/context.ts), so
    // R2Bucket.delete is always invoked with an array — even for a single
    // key. Unwrap the one-element array so this spy keeps asserting the key.
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        deleteSpy(key);
      }
    },
  } as unknown as R2Bucket;
}

async function buildApp(auth: AuthInfo, deleteSpy: (key: string) => void = () => {}) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket(deleteSpy) } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "org-user-1", role: "organizer", orgId: "org-1" };
const OTHER_ORG_ORGANIZER: AuthInfo = { userId: "org-user-2", role: "organizer", orgId: "org-2" };
const SPEAKER: AuthInfo = { userId: "speaker-user-1", role: "speaker", orgId: "org-1", contactId: "contact-speaker" };
const OTHER_SPEAKER: AuthInfo = { userId: "speaker-user-2", role: "speaker", orgId: "org-1", contactId: "contact-other" };

function del(app: Hono<AppEnv>, fileId: string) {
  return app.request(`/api/v1/files/${fileId}`, { method: "DELETE", headers: { "x-chq-csrf": "1" } });
}

describe("DELETE /api/v1/files/:fileId (DEC-713)", () => {
  it("lets an organizer delete any version in their org and deletes the R2 object via the file's own r2Key", async () => {
    const deleteSpy = vi.fn();
    const app = await buildApp(ORGANIZER, deleteSpy);
    const res = await del(app, "mid-file");
    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith("sub/sub-1/mid-file-deck-v2.pdf");
  });

  it("404s an organizer from a different org (existence-hiding, never 403)", async () => {
    const app = await buildApp(OTHER_ORG_ORGANIZER);
    const res = await del(app, "mid-file");
    expect(res.status).toBe(404);
  });

  it("lets a speaker delete their own latest version while pending", async () => {
    const deleteSpy = vi.fn();
    const app = await buildApp(SPEAKER, deleteSpy);
    const res = await del(app, "latest-file");
    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith("sub/sub-1/latest-file-deck-v3.pdf");
  });

  it("403s a speaker deleting a non-latest version of their own chain, naming the rule", async () => {
    const app = await buildApp(SPEAKER);
    const res = await del(app, "not-latest-file");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/latest version/i);
  });

  it("403s a speaker deleting their own latest version once the submission is no longer pending", async () => {
    const app = await buildApp(SPEAKER);
    const res = await del(app, "approved-latest-file");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/pending/i);
  });

  it("403s a speaker who didn't upload the version — no IDOR", async () => {
    const app = await buildApp(OTHER_SPEAKER);
    const res = await del(app, "latest-file");
    expect(res.status).toBe(403);
  });

  it("404s an unknown file id", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await del(app, "unknown-file");
    expect(res.status).toBe(404);
  });
});
