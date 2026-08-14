// DEC-995 amendment (wave 42): GET /portal/tasks/:assignmentId/file/:fileId
// (and the sibling chain-latest /file route) now route the served
// Content-Type through assertServedContentTypeHeader before writing it,
// mirroring src/routes/files.ts's coverage in
// test/file-serve-content-type.test.ts. This proves the inversion holds
// here too: a stored file_request row whose contentType column is
// 'text/html' must make the download THROW (never stream a byte), not 200
// with an HTML content type. Repo calls are mocked, same pattern as
// test/portal-file-versions.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const ASSIGNMENT_ID = "assignment-1";
const TASK_EVENT_ID = "event-1";
const FILE_HTML = "file-html-1";

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
  fileId: FILE_HTML,
};

// A stored row claiming text/html — the class of bad data
// assertServedContentTypeHeader exists to refuse at the response boundary,
// regardless of how it got into the column (a pre-fix row, a corrupted
// value, etc).
const HTML_ROW = {
  id: FILE_HTML,
  filename: "not-actually-a-slide-deck.pdf",
  contentType: "text/html",
  r2Key: "task/assignment-1/not-actually-a-slide-deck.pdf",
  createdAt: 0,
  versionNo: 1,
};

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
    resolveTaskFileChainLatestMany: vi.fn(),
    getFileVersionNumber: vi.fn(),
    listFileComments: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 1 })),
    listFileCommentsForFiles: vi.fn(async () => new Map()),
    listFileChainVersions: vi.fn(),
    listFileChainVersionsMany: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeFilesBucket(body: string) {
  return {
    async get() {
      return { body: new Response(body).body, httpMetadata: { contentType: "text/html" }, size: body.length } as unknown as R2ObjectBody;
    },
    async put() {},
    async delete() {},
  } as unknown as R2Bucket;
}

async function buildPortalApp(auth: AuthInfo) {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket("<script>evil</script>") } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

describe("DEC-995 amendment (wave 42): portal task-file download refuses a text/html stored row", () => {
  it("GET /portal/tasks/:assignmentId/file (chain-latest) throws — never streams — when the resolved row's contentType is text/html", async () => {
    const { resolveTaskFileChainLatest } = await import("../src/server/repo/files");
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    vi.mocked(resolveTaskFileChainLatest).mockResolvedValue(HTML_ROW);

    const app = await buildPortalApp(SPEAKER_A);
    const res = await app.request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/file`);

    // registerErrorHandler turns the thrown invariant violation into a 500
    // error PAGE (DEC-841) -- never a 200 that streams the stored bytes.
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("Internal server error");
    expect(text).not.toContain("<script>evil</script>");
  });

  it("GET /portal/tasks/:assignmentId/file/:fileId (any-version) throws — never streams — when the target row's contentType is text/html", async () => {
    const { listFileChainVersions } = await import("../src/server/repo/files");
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    vi.mocked(getAssignmentScope).mockResolvedValue(COMPLETE_SCOPE);
    vi.mocked(listFileChainVersions).mockResolvedValue([HTML_ROW]);

    const app = await buildPortalApp(SPEAKER_A);
    const res = await app.request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/file/${FILE_HTML}`);

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("Internal server error");
    expect(text).not.toContain("<script>evil</script>");
  });
});
