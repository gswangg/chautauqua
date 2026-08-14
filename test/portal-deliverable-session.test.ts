// DEC-891 coverage: task_assignment is UNIQUE(task_id, contact_id)
// (migrations/0019_join_table_uniqueness.sql:33), so a speaker with two
// accepted sessions in the same event has ONE file_request assignment but
// two candidate submissions an upload could belong to. This replaces the old
// DEC-240 deterministic lowest-seq tie-break (pickDeliverableSubmission /
// resolveDeliverableSubmissionId, deleted) with an explicit `submissionId`
// choice.
//
// 1) resolveChosenDeliverable: pure function matrix.
// 2) POST /portal/tasks/:id/upload: two accepted-session candidates -> two
//    distinct upload requests land two distinct file.submission_id values,
//    and a submissionId outside the candidate set 403s.

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import {
  resolveChosenDeliverable,
  type DeliverableCandidate,
  type PortalAssignmentScope,
} from "../src/server/repo/portal";

// ---------------------------------------------------------------------------
// 1) pure function matrix
// ---------------------------------------------------------------------------

const CAND_A: DeliverableCandidate = { id: "sub-a", ref: "SES-001", title: "Talk A", status: "accepted", seq: 1 };
const CAND_B: DeliverableCandidate = { id: "sub-b", ref: "SES-002", title: "Talk B", status: "accepted", seq: 2 };

describe("resolveChosenDeliverable (DEC-891)", () => {
  it("returns null for zero candidates, chosenId null", () => {
    expect(resolveChosenDeliverable([], null)).toBeNull();
  });

  it("returns null for zero candidates even if a chosenId was posted (nothing to link to)", () => {
    expect(resolveChosenDeliverable([], "sub-x")).toBeNull();
  });

  it("returns the single candidate when there is exactly one and chosenId is null", () => {
    expect(resolveChosenDeliverable([CAND_A], null)).toBe("sub-a");
  });

  it("returns the single candidate when there is exactly one and chosenId matches it", () => {
    expect(resolveChosenDeliverable([CAND_A], "sub-a")).toBe("sub-a");
  });

  it("throws forbidden when chosenId is non-null and not in the candidate set (single candidate)", () => {
    expect(() => resolveChosenDeliverable([CAND_A], "sub-foreign")).toThrow();
  });

  it("throws invalid when there are 2+ candidates and chosenId is null", () => {
    expect(() => resolveChosenDeliverable([CAND_A, CAND_B], null)).toThrow(/invalid|required/i);
  });

  it("returns the matching candidate when there are 2+ candidates and chosenId matches one", () => {
    expect(resolveChosenDeliverable([CAND_A, CAND_B], "sub-b")).toBe("sub-b");
  });

  it("throws forbidden when there are 2+ candidates and chosenId is not in the set", () => {
    expect(() => resolveChosenDeliverable([CAND_A, CAND_B], "sub-foreign")).toThrow();
  });

  it("error codes are actually ApiError with the right .code, not just message text", async () => {
    const { ApiError } = await import("../src/server/http");
    try {
      resolveChosenDeliverable([CAND_A, CAND_B], "sub-foreign");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as InstanceType<typeof ApiError>).code).toBe("forbidden");
    }
    try {
      resolveChosenDeliverable([CAND_A, CAND_B], null);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as InstanceType<typeof ApiError>).code).toBe("invalid");
    }
  });
});

// ---------------------------------------------------------------------------
// 2) route-level: two accepted sessions -> two distinct submission_id links,
// a foreign submissionId 403s
// ---------------------------------------------------------------------------

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const ASSIGNMENT_ID = "assignment-1";
const TASK_EVENT_ID = "event-1";

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(),
    listDeliverableCandidates: vi.fn(async () => [CAND_A, CAND_B]),
    saveTaskFileCompletion: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    insertFile: vi.fn(async () => "file-new-1"),
    reopenContentReview: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    updateAssignmentStatus: vi.fn(async () => ({ id: ASSIGNMENT_ID, status: "complete" })),
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

async function buildPortalApp(auth: AuthInfo) {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: fakeFilesBucket() } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

function uploadRequest(csrfToken: string, filename: string, submissionId?: string): Request {
  const form = new FormData();
  form.set("chq_csrf", csrfToken);
  form.set("file", new File(["hello world"], filename, { type: "application/pdf" }));
  if (submissionId !== undefined) form.set("submissionId", submissionId);
  return new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/upload`, {
    method: "POST",
    headers: { cookie: `chq_csrf=${csrfToken}` },
    body: form,
  });
}

describe("POST /portal/tasks/:assignmentId/upload with 2+ accepted sessions (DEC-891)", () => {
  const SPEAKER: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

  function mockScope(): PortalAssignmentScope {
    return {
      id: ASSIGNMENT_ID,
      taskId: "task-1",
      eventId: TASK_EVENT_ID,
      kind: "file_request",
      formId: null,
      deliverableKind: "presentation",
      contactId: CONTACT_A,
      orgId: ORG_A,
      status: "pending",
      fileId: null,
    };
  }

  it("two distinct posted submissionIds land two distinct file.submission_id values", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(mockScope());

    const appA = await buildPortalApp(SPEAKER);
    const resA = await appA.request(uploadRequest("tok-a", "slides-a.pdf", CAND_A.id));
    expect(resA.status).toBe(302);

    vi.mocked(getAssignmentScope).mockResolvedValue(mockScope());
    const appB = await buildPortalApp(SPEAKER);
    const resB = await appB.request(uploadRequest("tok-b", "slides-b.pdf", CAND_B.id));
    expect(resB.status).toBe(302);

    expect(insertFile).toHaveBeenCalledTimes(2);
    const submissionIds = vi.mocked(insertFile).mock.calls.map((call) => call[1].submissionId);
    expect(submissionIds).toEqual([CAND_A.id, CAND_B.id]);
    expect(new Set(submissionIds).size).toBe(2);
  });

  it("a submissionId outside the candidate set 403s (no file is ever written)", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(mockScope());

    const app = await buildPortalApp(SPEAKER);
    const res = await app.request(uploadRequest("tok-foreign", "slides-foreign.pdf", "sub-not-mine"));
    expect(res.status).toBe(403);
    expect(insertFile).not.toHaveBeenCalled();
  });

  it("no submissionId posted with 2+ candidates is a 400 (never a silent guess)", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(mockScope());

    const app = await buildPortalApp(SPEAKER);
    const res = await app.request(uploadRequest("tok-none", "slides-none.pdf"));
    expect(res.status).toBe(400);
    expect(insertFile).not.toHaveBeenCalled();
  });
});
