// DEC-248/DEC-040 wave-78 coverage: closing the two task-file write holes in
// src/routes/portal/tasks.tsx.
//
// (1) DEC-248: the plain upload route (~/upload) now stamps
// `taskAssignmentId` on every insertFile call, same as the form route
// (~/form) already did — so every version in a task file's chain carries its
// own stored link, and getTaskFileScope (files-authz.ts) can resolve a
// SUPERSEDED version whose task_assignment.fileId no longer names it (that
// column only ever points at the CURRENT completion file).
//
// (2) DEC-040: the form route no longer overwrites a re-answered file field
// with an unlinked file — it chains previousFileId onto the field's prior
// stored answer (mirrors the DEC-922 chain-or-restart rule the plain upload
// route already had), so the earlier row + its R2 object are never orphaned.
//
// Repo calls are mocked for the route-level assertions (no D1 test harness
// in this repo) — same pattern as test/portal-task-upload-chain.test.ts and
// test/portal-task-form-files.test.ts (both modules mocked ONCE at file
// scope — vitest only honours one factory per module per file). The
// GET-after-two-uploads assertion exercises the real (non-mocked)
// getTaskFileScope against an in-memory sqlite db — same technique as
// test/task-file-access.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { FormFieldRow } from "../src/server/repo/forms";

const ORG_A = "org-a";
const CONTACT_A = "contact-a";
const ASSIGNMENT_ID = "assignment-1";
const FORM_ID = "form-1";
const FILE_FIELD_ID = "field-receipt";

const SPEAKER_A: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

const FIELDS: FormFieldRow[] = [
  {
    id: FILE_FIELD_ID,
    formId: FORM_ID,
    section: "speaker",
    kind: "file",
    label: "Receipt or booking confirmation",
    required: false,
    position: 0,
    locked: false,
  },
];

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getAssignmentScope: vi.fn(),
    listDeliverableCandidates: vi.fn(),
    saveTaskFileCompletion: vi.fn(async () => {}),
    getMyTaskAssignments: vi.fn(),
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
        showResources: true,
      },
      submissions: [],
      tasks: [],
      contactName: "Speaker One",
    })),
    saveTaskFormResponse: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    listFields: vi.fn(async () => FIELDS),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getReplacesTarget: vi.fn(),
    insertFile: vi.fn(async () => "file-new"),
    reopenContentReview: vi.fn(async () => {}),
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
  const put = vi.fn(async () => {});
  return {
    put,
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket & { put: ReturnType<typeof vi.fn> };
}

async function buildPortalApp(bucket = fakeFilesBucket()) {
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", SPEAKER_A);
    c.set("db", {} as never);
    c.env = { ...(c.env ?? {}), FILES: bucket } as never;
    await next();
  });
  app.route("/portal", portalTasksRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// (1) plain upload route: insertFile carries taskAssignmentId
// ---------------------------------------------------------------------------

describe("POST /portal/tasks/:assignmentId/upload — DEC-248 wave-78: every version carries its own link", () => {
  function scopeFor(fileId: string | null) {
    return {
      id: ASSIGNMENT_ID,
      taskId: "task-1",
      eventId: "event-1",
      kind: "file_request" as const,
      formId: null,
      deliverableKind: null,
      contactId: CONTACT_A,
      orgId: ORG_A,
      status: fileId ? ("complete" as const) : ("pending" as const),
      fileId,
    };
  }

  async function postUpload() {
    const app = await buildPortalApp();
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.set("file", new File([new Uint8Array([1, 2, 3, 4])], "slides.pdf", { type: "application/pdf" }));
    return app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/upload`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );
  }

  it("stamps taskAssignmentId on a first-ever plain upload", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor(null));

    const res = await postUpload();

    expect(res.status).toBe(302);
    expect(insertFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ taskAssignmentId: ASSIGNMENT_ID }),
    );
  });

  it("stamps taskAssignmentId on a re-upload too (chained version)", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { getReplacesTarget, insertFile } = await import("../src/server/repo/files");
    const PRIOR_FILE_ID = "file-prior-1";
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor(PRIOR_FILE_ID));
    vi.mocked(getReplacesTarget).mockResolvedValue({ submissionId: null, kind: "handout" });

    const res = await postUpload();

    expect(res.status).toBe(302);
    expect(insertFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ taskAssignmentId: ASSIGNMENT_ID, previousFileId: PRIOR_FILE_ID }),
    );
  });
});

// ---------------------------------------------------------------------------
// (2) form route: re-answering a file field chains, never orphans
// ---------------------------------------------------------------------------

describe("POST /portal/tasks/:assignmentId/form — DEC-040 wave-78: re-answering a file field chains", () => {
  function scopeFor() {
    return {
      id: ASSIGNMENT_ID,
      taskId: "task-1",
      eventId: "event-1",
      kind: "form" as const,
      formId: FORM_ID,
      deliverableKind: null,
      contactId: CONTACT_A,
      orgId: ORG_A,
      status: "pending" as const,
      fileId: null,
    };
  }

  function assignmentWithResponse(responseJson: string | null) {
    return {
      id: ASSIGNMENT_ID,
      taskId: "task-1",
      eventId: "event-1",
      kind: "form" as const,
      title: "Flight reimbursement form",
      description: null,
      instructions: null,
      dueDate: null,
      assignedAt: 0,
      required: true,
      status: "pending",
      formId: FORM_ID,
      deliverableKind: null,
      fileId: null,
      responseJson,
      timezone: "UTC",
      completedAt: null,
    };
  }

  async function postForm(bucket: ReturnType<typeof fakeFilesBucket>, filename: string) {
    const app = await buildPortalApp(bucket);
    const form = new FormData();
    form.set("chq_csrf", "tok-1");
    form.set(`field__${FILE_FIELD_ID}`, new File([new Uint8Array([1, 2, 3, 4])], filename, { type: "application/pdf" }));
    return app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/form`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-1" },
        body: form,
      }),
    );
  }

  it("re-answering an already-filled file field chains previousFileId onto the prior answer (two-row chain, prior row untouched)", async () => {
    const { getAssignmentScope, getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { getReplacesTarget, insertFile } = await import("../src/server/repo/files");
    const PRIOR_FILE_ID = "file-prior-2";
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor());
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      assignmentWithResponse(JSON.stringify({ [FILE_FIELD_ID]: PRIOR_FILE_ID })),
    ]);
    vi.mocked(getReplacesTarget).mockResolvedValue({ submissionId: null, kind: "handout" });

    const bucket = fakeFilesBucket();
    const res = await postForm(bucket, "receipt-v2.pdf");

    expect(res.status).toBe(302);
    expect(getReplacesTarget).toHaveBeenCalledWith(expect.anything(), PRIOR_FILE_ID);
    // the new row chains onto the prior row — never an unlinked
    // (previousFileId: null) mint that would orphan it.
    expect(insertFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        previousFileId: PRIOR_FILE_ID,
        taskAssignmentId: ASSIGNMENT_ID,
        submissionId: null,
        kind: "handout",
      }),
    );
    // the request succeeds (302, no validation failure) — the rollback path
    // that deletes THIS request's own writes on a 400 never runs, so the
    // prior row is never touched by it.
  });

  it("a mismatched prior target (foreign/legacy row) starts a fresh chain, never a 400", async () => {
    const { getAssignmentScope, getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { getReplacesTarget, insertFile } = await import("../src/server/repo/files");
    const PRIOR_FILE_ID = "file-prior-3";
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor());
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      assignmentWithResponse(JSON.stringify({ [FILE_FIELD_ID]: PRIOR_FILE_ID })),
    ]);
    // prior target belongs to a submission (a deliverable, not a plain
    // handout answer) — mismatch, must not chain.
    vi.mocked(getReplacesTarget).mockResolvedValue({ submissionId: "submission-1", kind: "presentation" });

    const bucket = fakeFilesBucket();
    const res = await postForm(bucket, "receipt-v2.pdf");

    expect(res.status).toBe(302); // never a 400 for a chain mismatch
    expect(insertFile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ previousFileId: null }));
  });

  it("a fresh (never-before-answered) file field never calls getReplacesTarget and starts unchained", async () => {
    const { getAssignmentScope, getMyTaskAssignments } = await import("../src/server/repo/portal");
    const { getReplacesTarget, insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue(scopeFor());
    vi.mocked(getMyTaskAssignments).mockResolvedValue([assignmentWithResponse(null)]);

    const bucket = fakeFilesBucket();
    const res = await postForm(bucket, "receipt.pdf");

    expect(res.status).toBe(302);
    expect(getReplacesTarget).not.toHaveBeenCalled();
    expect(insertFile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ previousFileId: null }));
  });
});

// ---------------------------------------------------------------------------
// (3) getTaskFileScope resolves a SUPERSEDED version once it carries its own
// taskAssignmentId — real (non-mocked) implementation against an in-memory
// sqlite db, same technique as test/task-file-access.test.ts. Pins the exact
// regression named in the task: before this fix, task_assignment.fileId only
// ever names the chain HEAD, so the v1 file (superseded, no taskAssignmentId
// of its own under the old write path) resolved to nothing for either the
// organizer or the assigned speaker.
// ---------------------------------------------------------------------------
describe("getTaskFileScope resolves every chain version once each carries its own link (DEC-248 wave-78, real db)", () => {
  const DDL = `
    create table event (
      id text primary key,
      org_id text
    );
    create table task (
      id text primary key,
      event_id text
    );
    create table task_assignment (
      id text primary key,
      task_id text,
      contact_id text,
      status text,
      file_id text,
      created_at integer,
      updated_at integer
    );
    create table file (
      id text primary key,
      submission_id text,
      kind text,
      filename text,
      r2_key text,
      size_bytes integer,
      content_type text,
      uploaded_by_contact_id text,
      task_assignment_id text,
      previous_file_id text,
      created_at integer,
      updated_at integer
    );
  `;

  async function makeTestDb() {
    const { DatabaseSync } = await import("node:sqlite");
    const { drizzle } = await import("drizzle-orm/sqlite-proxy");
    const schema = await import("../src/db/schema");
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(DDL);
    const db = drizzle(
      async (sqlText: string, params: unknown[], method: string) => {
        const stmt = sqlite.prepare(sqlText);
        stmt.setReturnArrays(true);
        if (method === "run") {
          stmt.run(...(params as never[]));
          return { rows: [] };
        }
        const rows = stmt.all(...(params as never[])) as unknown[];
        return { rows };
      },
      { schema },
    );
    return { db: db as unknown as import("../src/server/context").Db, sqlite };
  }

  it("v1 (superseded, taskAssignmentId set) resolves organizer 200-eligible and the assigned speaker 200-eligible, a foreign speaker still denied", async () => {
    const filesAuthz = await vi.importActual<typeof import("../src/server/repo/files-authz")>(
      "../src/server/repo/files-authz",
    );
    const { db, sqlite } = await makeTestDb();
    sqlite.prepare(`insert into event (id, org_id) values ('event-1', 'org-a')`).run();
    sqlite.prepare(`insert into task (id, event_id) values ('task-1', 'event-1')`).run();
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, file_id, created_at, updated_at)
         values ('assignment-1', 'task-1', 'contact-assigned', 'complete', 'file-v2', 0, 0)`,
      )
      .run();
    // v1: superseded — task_assignment.fileId now names v2, not v1. Under the
    // wave-78 fix v1 still carries its OWN taskAssignmentId, written at
    // insert time by the plain upload route.
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, uploaded_by_contact_id, task_assignment_id, previous_file_id, created_at, updated_at)
         values ('file-v1', null, 'handout', 'v1.pdf', 'k1', 10, 'application/pdf', 'contact-assigned', 'assignment-1', null, 0, 0)`,
      )
      .run();
    // v2: the current head, chained onto v1.
    sqlite
      .prepare(
        `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, uploaded_by_contact_id, task_assignment_id, previous_file_id, created_at, updated_at)
         values ('file-v2', null, 'handout', 'v2.pdf', 'k2', 10, 'application/pdf', 'contact-assigned', 'assignment-1', 'file-v1', 1, 1)`,
      )
      .run();

    const v1Scope = await filesAuthz.getTaskFileScope(db, "file-v1");
    expect(v1Scope).not.toBeNull();
    expect(filesAuthz.canAccessTaskFile({ role: "organizer", orgId: "org-a" }, v1Scope!)).toBe(true);
    expect(
      filesAuthz.canAccessTaskFile({ role: "speaker", orgId: "org-a", contactId: "contact-assigned" }, v1Scope!),
    ).toBe(true);
    expect(
      filesAuthz.canAccessTaskFile({ role: "speaker", orgId: "org-a", contactId: "contact-foreign" }, v1Scope!),
    ).toBe(false);

    sqlite.close();
  });
});
