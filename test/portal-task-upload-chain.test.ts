// DEC-922 coverage (task w22-c): POST /portal/tasks/:assignmentId/file (the
// re-upload handler) must not chain onto another submission's deliverable.
// scope.fileId is this ASSIGNMENT's own prior upload, but DEC-891 lets the
// speaker re-choose a different eligible submission on each upload. Chaining
// unconditionally would let insertFile label the OTHER submission's first
// deliverable 'v2', and resolveTaskFileChainLatest would then serve it back
// as this task's file. The fix mirrors domain/files.ts's isValidVersionChain
// rule: chain only when the previous file's {submissionId, kind} exactly
// matches the new upload's — never a 400 for the speaker; a mismatch just
// starts a fresh chain at v1. Repo calls are mocked (no D1 test harness in
// this repo) — same pattern as test/portal-deliverable.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const ASSIGNMENT_ID = "assignment-1";
const TASK_EVENT_ID = "event-1";

const SUBMISSION_1 = "submission-1";
const SUBMISSION_2 = "submission-2";
const PRIOR_FILE_ID = "file-prior-1";
const NEW_FILE_ID = "file-new-1";

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(),
    listDeliverableCandidates: vi.fn(),
    saveTaskFileCompletion: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getReplacesTarget: vi.fn(),
    insertFile: vi.fn(async () => NEW_FILE_ID),
  };
});

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    updateAssignmentStatus: vi.fn(async () => {}),
  };
});

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

async function buildPortalApp() {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", SPEAKER_A);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

function scopeFor(deliverableKind: string | null, fileId: string | null) {
  return {
    id: ASSIGNMENT_ID,
    taskId: "task-1",
    eventId: TASK_EVENT_ID,
    kind: "file_request" as const,
    formId: null,
    deliverableKind,
    contactId: CONTACT_A,
    orgId: ORG_A,
    status: fileId ? ("complete" as const) : ("pending" as const),
    fileId,
  };
}

async function postUpload(submissionId?: string) {
  const app = await buildPortalApp();
  const form = new FormData();
  form.set("chq_csrf", "tok-1");
  form.set("file", new File([new Uint8Array([1, 2, 3, 4])], "slides.pdf", { type: "application/pdf" }));
  if (submissionId != null) form.set("submissionId", submissionId);
  return app.request(
    new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/upload`, {
      method: "POST",
      headers: { cookie: "chq_csrf=tok-1" },
      body: form,
    }),
  );
}

describe("POST /portal/tasks/:assignmentId/upload — DEC-922 chain scoping", () => {
  it("(a) re-uploading naming the SAME submission still chains: previousFileId = prior file, versionNo continues", async () => {
    const { getAssignmentScope, listDeliverableCandidates } = await import("../src/server/repo/portal");
    const { getReplacesTarget, insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor("presentation", PRIOR_FILE_ID));
    vi.mocked(listDeliverableCandidates).mockResolvedValue([
      { id: SUBMISSION_1, ref: "T-1", title: "Talk One", status: "accepted", seq: 1 },
      { id: SUBMISSION_2, ref: "T-2", title: "Talk Two", status: "accepted", seq: 2 },
    ]);
    vi.mocked(getReplacesTarget).mockResolvedValue({ submissionId: SUBMISSION_1, kind: "presentation" });

    const res = await postUpload(SUBMISSION_1);
    expect(res.status).toBe(302);
    expect(insertFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ submissionId: SUBMISSION_1, kind: "presentation", previousFileId: PRIOR_FILE_ID }),
    );
  });

  it("(b) re-uploading naming a DIFFERENT eligible submission starts a fresh chain: previousFileId = null", async () => {
    const { getAssignmentScope, listDeliverableCandidates } = await import("../src/server/repo/portal");
    const { getReplacesTarget, insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor("presentation", PRIOR_FILE_ID));
    vi.mocked(listDeliverableCandidates).mockResolvedValue([
      { id: SUBMISSION_1, ref: "T-1", title: "Talk One", status: "accepted", seq: 1 },
      { id: SUBMISSION_2, ref: "T-2", title: "Talk Two", status: "accepted", seq: 2 },
    ]);
    // the prior file belongs to submission 1; the new upload names submission 2
    vi.mocked(getReplacesTarget).mockResolvedValue({ submissionId: SUBMISSION_1, kind: "presentation" });

    const res = await postUpload(SUBMISSION_2);
    expect(res.status).toBe(302);
    expect(insertFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ submissionId: SUBMISSION_2, kind: "presentation", previousFileId: null }),
    );
  });

  it("(c) a handout task (deliverableKind null, submissionId null) still chains across re-uploads", async () => {
    const { getAssignmentScope, listDeliverableCandidates } = await import("../src/server/repo/portal");
    const { getReplacesTarget, insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor(null, PRIOR_FILE_ID));
    vi.mocked(getReplacesTarget).mockResolvedValue({ submissionId: null, kind: "handout" });

    const res = await postUpload();
    expect(res.status).toBe(302);
    expect(listDeliverableCandidates).not.toHaveBeenCalled();
    expect(insertFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ submissionId: null, kind: "handout", previousFileId: PRIOR_FILE_ID }),
    );
  });

  it("first-ever upload (scope.fileId null) never calls getReplacesTarget and starts at v1", async () => {
    const { getAssignmentScope, listDeliverableCandidates } = await import("../src/server/repo/portal");
    const { getReplacesTarget, insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor("presentation", null));
    vi.mocked(listDeliverableCandidates).mockResolvedValue([
      { id: SUBMISSION_1, ref: "T-1", title: "Talk One", status: "accepted", seq: 1 },
    ]);

    const res = await postUpload(SUBMISSION_1);
    expect(res.status).toBe(302);
    expect(getReplacesTarget).not.toHaveBeenCalled();
    expect(insertFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ submissionId: SUBMISSION_1, kind: "presentation", previousFileId: null }),
    );
  });
});
