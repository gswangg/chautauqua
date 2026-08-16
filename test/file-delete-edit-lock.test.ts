// DEC-041 wave-46 amendment: DELETE /api/v1/files/:fileId (DEC-713 version
// deletion) is a destructive speaker write, just like upload and comment —
// it must obey the SAME server-side edit lock (src/domain/edit-lock.ts
// canEditSubmission), not just the uploader/latest/pending-content checks.
// Modelled on test/deliverable-edit-lock.test.ts. A source-scan assertion at
// the bottom enforces that canEditSubmission is called from exactly ONE
// place in src/routes/files.ts (assertSpeakerSubmissionUnlocked) — every
// speaker write path routes through it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { FileDeleteScope } from "../src/server/repo/files-versions";

const ORG_A = "org-a";
const SPEAKER_CONTACT = "contact-speaker";

const NOW = Date.parse("2026-06-01T12:00:00Z");
const CLOSED_DATE = Date.parse("2026-01-01T00:00:00Z"); // well in the past -> form closed
const OPEN_DATE = Date.parse("2099-01-01T00:00:00Z"); // far future -> form open
const TZ = "America/New_York";

const SCOPES: Record<string, FileDeleteScope> = {
  // speaker's own latest pending version, form CLOSED — must now be locked
  // (wave-46: this previously fell through, unlike upload/comment).
  "file-pending-closed": {
    id: "file-pending-closed",
    submissionId: "sub-pending-closed",
    eventId: "event-1",
    orgId: ORG_A,
    filename: "deck.pdf",
    r2Key: "sub/file-pending-closed-deck.pdf",
    previousFileId: null,
    uploadedByContactId: SPEAKER_CONTACT,
    contentStatus: "pending",
    status: "pending",
    formCloseDate: CLOSED_DATE,
    timezone: TZ,
    isLatestInChain: true,
    assignmentContactId: null,
  },
  // same speaker, same shape, form still OPEN — must be allowed.
  "file-pending-open": {
    id: "file-pending-open",
    submissionId: "sub-pending-open",
    eventId: "event-1",
    orgId: ORG_A,
    filename: "deck.pdf",
    r2Key: "sub/file-pending-open-deck.pdf",
    previousFileId: null,
    uploadedByContactId: SPEAKER_CONTACT,
    contentStatus: "pending",
    status: "pending",
    formCloseDate: OPEN_DATE,
    timezone: TZ,
    isLatestInChain: true,
    assignmentContactId: null,
  },
  // organizer target, form closed — organizers are never locked.
  "file-organizer-closed": {
    id: "file-organizer-closed",
    submissionId: "sub-organizer-closed",
    eventId: "event-1",
    orgId: ORG_A,
    filename: "deck.pdf",
    r2Key: "sub/file-organizer-closed-deck.pdf",
    previousFileId: null,
    uploadedByContactId: SPEAKER_CONTACT,
    contentStatus: "pending",
    status: "pending",
    formCloseDate: CLOSED_DATE,
    timezone: TZ,
    isLatestInChain: true,
    assignmentContactId: null,
  },
  // organizer target, form open — organizers are never locked.
  "file-organizer-open": {
    id: "file-organizer-open",
    submissionId: "sub-organizer-open",
    eventId: "event-1",
    orgId: ORG_A,
    filename: "deck.pdf",
    r2Key: "sub/file-organizer-open-deck.pdf",
    previousFileId: null,
    uploadedByContactId: SPEAKER_CONTACT,
    contentStatus: "pending",
    status: "pending",
    formCloseDate: OPEN_DATE,
    timezone: TZ,
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

vi.useFakeTimers();
vi.setSystemTime(NOW);

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket() {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildApp(auth: AuthInfo) {
  const { fileApiRoutes } = await import("../src/routes/files");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/api/v1", fileApiRoutes);
  return app;
}

const speaker: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: ORG_A, contactId: SPEAKER_CONTACT };
const organizer: AuthInfo = { userId: "u-organizer", role: "organizer", orgId: ORG_A };

function del(app: Hono<AppEnv>, fileId: string) {
  return app.request(`/api/v1/files/${fileId}`, { method: "DELETE", headers: { "x-chq-csrf": "1" } });
}

describe("DELETE /api/v1/files/:fileId — DEC-041 wave-46 edit lock", () => {
  it("403s a speaker deleting their own latest pending version once the form is closed, with the same message the upload path returns", async () => {
    const app = await buildApp(speaker);
    const res = await del(app, "file-pending-closed");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("This submission can no longer be edited");
  });

  it("allows a speaker to delete their own latest pending version while the form is still open", async () => {
    const app = await buildApp(speaker);
    const res = await del(app, "file-pending-open");
    expect(res.status).toBe(200);
  });

  it("never locks an organizer — form closed", async () => {
    const app = await buildApp(organizer);
    const res = await del(app, "file-organizer-closed");
    expect(res.status).toBe(200);
  });

  it("never locks an organizer — form open", async () => {
    const app = await buildApp(organizer);
    const res = await del(app, "file-organizer-open");
    expect(res.status).toBe(200);
  });
});

describe("assertSpeakerSubmissionUnlocked — ONE predicate for every speaker write path", () => {
  it("canEditSubmission is called exactly once in src/routes/files.ts, inside assertSpeakerSubmissionUnlocked", () => {
    const filesRouteUrl = new URL("../src/routes/files.ts", import.meta.url);
    const source = readFileSync(fileURLToPath(filesRouteUrl), "utf8");
    const callSites = source.match(/canEditSubmission\(/g) ?? [];
    expect(callSites.length).toBe(1);

    const helperStart = source.indexOf("function assertSpeakerSubmissionUnlocked");
    expect(helperStart).toBeGreaterThan(-1);
    const callSiteIndex = source.indexOf("canEditSubmission(");
    const helperEnd = source.indexOf("\n}", helperStart);
    expect(callSiteIndex).toBeGreaterThan(helperStart);
    expect(callSiteIndex).toBeLessThan(helperEnd);
  });
});
