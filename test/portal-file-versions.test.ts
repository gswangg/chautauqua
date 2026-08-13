// DEC-605 coverage (task w4-d): speaker-side file version history in the
// portal. Today the completed-task card only showed the chain HEAD
// ('version N' + Replace file), so a re-upload read as an overwrite from the
// only side that ever made it. This covers:
//   - GET /portal/tasks renders the FULL chain (oldest -> newest), one row
//     per version, each with its own download link and the newest flagged
//     "Current".
//   - GET /portal/tasks/:assignmentId/file/:fileId (new, beside the DEC-244
//     chain-latest route) streams any version IN the requesting assignment's
//     chain, and 404s (never 403 — existence-hiding) a fileId that doesn't
//     walk back to that assignment's chain root, including one that
//     genuinely belongs to a DIFFERENT assignment/chain (an id in the URL is
//     never evidence of ownership).
// Repo calls are mocked (no D1 test harness in this repo) — same pattern as
// test/portal-deliverable.test.ts / test/portal-deliverable-panel.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const CONTACT_B = "contact-b";
const ASSIGNMENT_ID = "assignment-1";
const TASK_EVENT_ID = "event-1";

const FILE_V1 = "file-v1";
const FILE_V2 = "file-v2";
const FILE_V3_LATEST = "file-v3-latest";

const COMPLETE_SCOPE = {
  id: ASSIGNMENT_ID,
  taskId: "task-1",
  eventId: TASK_EVENT_ID,
  kind: "file_request" as const,
  formId: null,
  deliverableKind: "presentation",
  contactId: CONTACT_A,
  orgId: ORG_A,
  status: "complete",
  fileId: FILE_V1,
};

const T0 = Date.parse("2026-01-01T00:00:00Z");

const CHAIN_LATEST = {
  id: FILE_V3_LATEST,
  filename: "slides-v3.pdf",
  contentType: "application/pdf",
  r2Key: "task/assignment-1/slides-v3.pdf",
  createdAt: T0 + 2 * 86_400_000,
};

const CHAIN_VERSIONS = [
  { id: FILE_V1, filename: "slides-v1.pdf", contentType: "application/pdf", r2Key: "task/assignment-1/slides-v1.pdf", createdAt: T0 },
  {
    id: FILE_V2,
    filename: "slides-v2.pdf",
    contentType: "application/pdf",
    r2Key: "task/assignment-1/slides-v2.pdf",
    createdAt: T0 + 86_400_000,
  },
  CHAIN_LATEST,
];

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(),
    getMyTaskAssignments: vi.fn(),
    getPortalData: vi.fn(async () => ({
      branding: { eventName: "Demo Event", welcomeMessage: null, accentColor: null, logoUrl: null },
    })),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    resolveTaskFileChainLatest: vi.fn(),
    getFileVersionNumber: vi.fn(),
    listFileComments: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 1 })),
    listFileChainVersions: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket(body: string | null) {
  return {
    async get(key: string) {
      if (body === null) return null;
      return { body: new Response(body).body, httpMetadata: { contentType: "application/pdf" }, size: body.length, key } as unknown as R2ObjectBody;
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildPortalApp(auth: AuthInfo, filesBody: string | null = "pdf-bytes") {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket(filesBody) } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };
const SPEAKER_B: AuthInfo = { userId: "u2", role: "speaker", orgId: ORG_A, contactId: CONTACT_B };

describe("GET /portal/tasks — full version chain (DEC-605)", () => {
  it("renders one row per version, oldest to newest, each with its own download link, newest flagged Current", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { resolveTaskFileChainLatest, listFileChainVersions, getFileVersionNumber } = await import("../src/server/repo/files");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      {
        id: ASSIGNMENT_ID,
        taskId: "task-1",
        eventId: "evt-1",
        kind: "file_request",
        title: "Upload slides",
        description: null,
        dueDate: null,
        assignedAt: 0,
        required: true,
        status: "complete",
        formId: null,
        fileId: FILE_V1,
        responseJson: null,
        timezone: "UTC",
        completedAt: null,
      },
    ]);
    vi.mocked(resolveTaskFileChainLatest).mockResolvedValue(CHAIN_LATEST);
    vi.mocked(listFileChainVersions).mockResolvedValue(CHAIN_VERSIONS);
    vi.mocked(getFileVersionNumber).mockImplementation(async (_db, id) => {
      const idx = CHAIN_VERSIONS.findIndex((v) => v.id === id);
      if (idx === -1) throw new Error(`unexpected file id in test: ${id}`);
      return idx + 1;
    });

    const app = await buildPortalApp(SPEAKER_A);
    const res = await app.request("http://test.local/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();

    // one row per version, each linking through the new per-version route
    expect(html).toContain(`href="/portal/tasks/${ASSIGNMENT_ID}/file/${FILE_V1}"`);
    expect(html).toContain(`href="/portal/tasks/${ASSIGNMENT_ID}/file/${FILE_V2}"`);
    expect(html).toContain(`href="/portal/tasks/${ASSIGNMENT_ID}/file/${FILE_V3_LATEST}"`);
    expect(html).toContain("slides-v1.pdf");
    expect(html).toContain("slides-v2.pdf");
    expect(html).toContain("slides-v3.pdf");
    expect(html).toContain("v1");
    expect(html).toContain("v2");
    expect(html).toContain("v3");

    // oldest-to-newest ordering — scoped to the "Version history" section
    // since the single-file block above it ALSO shows the latest filename
    // (v3), so a plain first-occurrence indexOf would find that instead.
    const historyIdx = html.indexOf("Version history");
    expect(historyIdx).toBeGreaterThan(-1);
    const history = html.slice(historyIdx);
    const idxV1 = history.indexOf("slides-v1.pdf");
    const idxV2 = history.indexOf("slides-v2.pdf");
    const idxV3 = history.indexOf("slides-v3.pdf");
    expect(idxV1).toBeGreaterThan(-1);
    expect(idxV1).toBeLessThan(idxV2);
    expect(idxV2).toBeLessThan(idxV3);

    // only the newest is flagged Current
    const currentCount = (history.match(/>Current</g) ?? []).length;
    expect(currentCount).toBe(1);
    expect(history.indexOf(">Current<")).toBeGreaterThan(idxV3);
  });
});

describe("GET /portal/tasks/:assignmentId/file/:fileId (DEC-605)", () => {
  it("streams a non-latest version's bytes with an attachment disposition", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { listFileChainVersions } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    vi.mocked(listFileChainVersions).mockResolvedValue(CHAIN_VERSIONS);

    const app = await buildPortalApp(SPEAKER_A, "v1-bytes");
    const res = await app.request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/file/${FILE_V1}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain("slides-v1.pdf");
    const text = await res.text();
    expect(text).toBe("v1-bytes");
    // the requested-id lookup is a membership check against the
    // ASSIGNMENT's own stored fileId, never against the untrusted URL param
    expect(listFileChainVersions).toHaveBeenCalledWith(expect.anything(), COMPLETE_SCOPE.fileId);
  });

  it("404s a fileId that belongs to a DIFFERENT chain — a foreign id is a 404, not a 403", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { listFileChainVersions } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    vi.mocked(listFileChainVersions).mockResolvedValue(CHAIN_VERSIONS);

    const app = await buildPortalApp(SPEAKER_A);
    const res = await app.request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/file/file-from-someone-elses-chain`);

    expect(res.status).toBe(404);
  });

  it("404/403s speaker B probing speaker A's assignment — no IDOR", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { listFileChainVersions } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);

    const app = await buildPortalApp(SPEAKER_B);
    const res = await app.request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/file/${FILE_V1}`);

    expect([403, 404]).toContain(res.status);
    expect(listFileChainVersions).not.toHaveBeenCalled();
  });

  it("404s an unknown assignment id", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    vi.mocked(getAssignmentScope).mockResolvedValue(null);

    const app = await buildPortalApp(SPEAKER_A);
    const res = await app.request(`http://test.local/portal/tasks/does-not-exist/file/${FILE_V1}`);
    expect(res.status).toBe(404);
  });
});
