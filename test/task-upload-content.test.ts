// DEC-240 coverage (task w1-d): task-assignment uploads join the content
// pipeline instead of DEC-029's submission_id-null/'handout'-only rule.
//
// 1) pickDeliverableSubmission: the pure deterministic tie-break.
// 2) POST /portal/tasks/:id/upload: first upload links file.submission_id
//    via resolveDeliverableSubmissionId and uses the task's deliverableKind;
//    a second upload on the same (now-complete) assignment chains
//    previous_file_id to the prior file and updates assignment.file_id.
//    Repo calls are mocked (no D1 test harness in this repo — same pattern
//    as test/task-file-access.test.ts).
// 3) Read side: an in-memory fake Db (pattern from test/files-library.test.ts)
//    seeded with the two chained file rows a DEC-240 upload produces shows
//    the chain in listEventDeliverableFiles (versionCount 2) and the file
//    counts in listSubmissionFiles (the function backing
//    GET /api/v1/submissions/:id/files).

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { pickDeliverableSubmission } from "../src/server/repo/portal";
import * as schema from "../src/db/schema";

// ---------------------------------------------------------------------------
// 1) pure tie-break
// ---------------------------------------------------------------------------

describe("pickDeliverableSubmission (DEC-240 deterministic linkage)", () => {
  it("returns null for no candidates", () => {
    expect(pickDeliverableSubmission([])).toBeNull();
  });

  it("picks the lowest-seq 'accepted' submission when any exist, ignoring lower-seq non-accepted ones", () => {
    const result = pickDeliverableSubmission([
      { id: "sub-pending-1", status: "pending", seq: 1 },
      { id: "sub-accepted-9", status: "accepted", seq: 9 },
      { id: "sub-accepted-3", status: "accepted", seq: 3 },
    ]);
    expect(result).toBe("sub-accepted-3");
  });

  it("falls back to the lowest-seq submission of any status when none is accepted", () => {
    const result = pickDeliverableSubmission([
      { id: "sub-pending-5", status: "pending", seq: 5 },
      { id: "sub-declined-2", status: "declined", seq: 2 },
    ]);
    expect(result).toBe("sub-declined-2");
  });
});

// ---------------------------------------------------------------------------
// 2) route-level: linkage + chaining on re-upload
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
    resolveDeliverableSubmissionId: vi.fn(async () => "sub-resolved-1"),
    saveTaskFileCompletion: vi.fn(async () => {}),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    insertFile: vi.fn(async () => "file-new-1"),
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

function uploadRequest(csrfToken: string, filename: string): Request {
  const form = new FormData();
  form.set("chq_csrf", csrfToken);
  form.set("file", new File(["hello world"], filename, { type: "application/pdf" }));
  return new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/upload`, {
    method: "POST",
    headers: { cookie: `chq_csrf=${csrfToken}` },
    body: form,
  });
}

describe("POST /portal/tasks/:assignmentId/upload (DEC-240)", () => {
  const SPEAKER: AuthInfo = { userId: "u1", role: "speaker", orgId: ORG_A, contactId: CONTACT_A };

  it("first upload: links submission_id via resolveDeliverableSubmissionId, uses the task's deliverableKind, previousFileId null", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue({
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
    });

    const app = await buildPortalApp(SPEAKER);
    const res = await app.request(uploadRequest("tok-1", "slides.pdf"));
    expect(res.status).toBe(302);

    expect(insertFile).toHaveBeenCalledTimes(1);
    const call = vi.mocked(insertFile).mock.calls[0]![1];
    expect(call).toMatchObject({
      submissionId: "sub-resolved-1",
      kind: "presentation",
      previousFileId: null,
      uploadedByContactId: CONTACT_A,
    });
  });

  it("second upload on an already-complete assignment: chains previous_file_id to the assignment's current file and stays 'complete'", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFile } = await import("../src/server/repo/files");
    const { updateAssignmentStatus } = await import("../src/server/repo/tasks");
    vi.mocked(getAssignmentScope).mockResolvedValue({
      id: ASSIGNMENT_ID,
      taskId: "task-1",
      eventId: TASK_EVENT_ID,
      kind: "file_request",
      formId: null,
      deliverableKind: "presentation",
      contactId: CONTACT_A,
      orgId: ORG_A,
      status: "complete",
      fileId: "file-existing-1",
    });

    const app = await buildPortalApp(SPEAKER);
    const res = await app.request(uploadRequest("tok-2", "slides-v2.pdf"));
    expect(res.status).toBe(302);

    const call = vi.mocked(insertFile).mock.calls[0]![1];
    expect(call).toMatchObject({ previousFileId: "file-existing-1" });
    // status transition still requested as 'complete' (replacement keeps
    // status complete, refreshing completedAt/completedBy).
    expect(updateAssignmentStatus).toHaveBeenCalledWith(
      expect.anything(),
      ASSIGNMENT_ID,
      "complete",
      SPEAKER.userId,
      expect.any(Date),
    );
  });

  it("falls back to 'handout' when the task has no deliverableKind set", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    const { insertFile } = await import("../src/server/repo/files");
    vi.mocked(getAssignmentScope).mockResolvedValue({
      id: ASSIGNMENT_ID,
      taskId: "task-1",
      eventId: TASK_EVENT_ID,
      kind: "file_request",
      formId: null,
      deliverableKind: null,
      contactId: CONTACT_A,
      orgId: ORG_A,
      status: "pending",
      fileId: null,
    });

    const app = await buildPortalApp(SPEAKER);
    const res = await app.request(uploadRequest("tok-3", "handout.pdf"));
    expect(res.status).toBe(302);
    const call = vi.mocked(insertFile).mock.calls[0]![1];
    expect(call).toMatchObject({ kind: "handout" });
  });
});

// ---------------------------------------------------------------------------
// 3) read side: the linked file surfaces in listEventDeliverableFiles and
// listSubmissionFiles (backing GET /api/v1/submissions/:id/files)
// ---------------------------------------------------------------------------

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: unknown[] };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
  };
});

const { listEventDeliverableFiles, listSubmissionFiles } = await import("../src/server/repo/files");

const TABLE_SCHEMAS = {
  event: schema.event,
  submission: schema.submission,
  file: schema.file,
  participant: schema.participant,
  contact: schema.contact,
};

function colKey(col: unknown): string {
  for (const tableObj of Object.values(TABLE_SCHEMAS)) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return key;
    }
  }
  throw new Error("fake db: condition referenced a column not on a known table");
}

function evalCond(cond: unknown, row: Record<string, unknown>): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") return row[colKey(m.col)] === m.val;
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "inArray") return m.vals.includes(row[colKey(m.col)]);
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

function project(row: Record<string, unknown>, fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [outKey, col] of Object.entries(fields)) out[outKey] = row[colKey(col)];
  return out;
}

function makeFakeDb(seed: {
  event: Record<string, unknown>[];
  submission: Record<string, unknown>[];
  file: Record<string, unknown>[];
  participant: Record<string, unknown>[];
  contact: Record<string, unknown>[];
}) {
  const byTable = new Map<unknown, Record<string, unknown>[]>([
    [schema.event, seed.event],
    [schema.submission, seed.submission],
    [schema.file, seed.file],
    [schema.participant, seed.participant],
    [schema.contact, seed.contact],
  ]);

  const db = {
    select(fields?: Record<string, unknown>) {
      let source: Record<string, unknown>[] = [];
      let whereCond: unknown = null;
      let orderDesc = false;
      const run = () => {
        let filtered = whereCond ? source.filter((r) => evalCond(whereCond, r)) : source.slice();
        if (orderDesc) {
          filtered = filtered.slice().sort((a, b) => {
            const av = (a.createdAt as Date).getTime();
            const bv = (b.createdAt as Date).getTime();
            return bv - av;
          });
        }
        return fields ? filtered.map((r) => project(r, fields)) : filtered.map((r) => ({ ...r }));
      };
      const chain: any = {
        from: (table: unknown) => {
          source = byTable.get(table) ?? [];
          return chain;
        },
        where: (cond: unknown) => {
          whereCond = cond;
          return chain;
        },
        orderBy: () => {
          orderDesc = true;
          return chain;
        },
        limit: async (n: number) => run().slice(0, n),
        then: (resolve: (v: unknown[]) => void) => resolve(run()),
      };
      return chain;
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

describe("read side: DEC-240-linked task upload surfaces through existing file queries", () => {
  function seedWithChainedTaskUpload() {
    const now = new Date("2026-02-01T00:00:00Z");
    const later = new Date("2026-02-02T00:00:00Z");
    return {
      event: [{ id: "event-1", orgId: "org-1", slug: "demo", recordPrefix: "SES" }],
      submission: [{ id: "sub-1", eventId: "event-1", seq: 3, title: "A Talk About Testing" }],
      file: [
        {
          id: "file-v1",
          submissionId: "sub-1",
          kind: "presentation",
          filename: "slides-v1.pdf",
          previousFileId: null,
          sizeBytes: 100,
          contentType: "application/pdf",
          uploadedByContactId: "contact-speaker",
          createdAt: now,
        },
        // Second (re-)upload through the portal task-upload path: chains
        // previous_file_id to the first, same submission_id (DEC-240).
        {
          id: "file-v2",
          submissionId: "sub-1",
          kind: "presentation",
          filename: "slides-v2.pdf",
          previousFileId: "file-v1",
          sizeBytes: 120,
          contentType: "application/pdf",
          uploadedByContactId: "contact-speaker",
          createdAt: later,
        },
      ],
      participant: [{ submissionId: "sub-1", contactId: "contact-speaker", order: 0, role: "speaker" }],
      contact: [{ id: "contact-speaker", firstName: "Sam", lastName: "Speaker" }],
    };
  }

  it("listEventDeliverableFiles surfaces the chain as one row with versionCount 2", async () => {
    const db = makeFakeDb(seedWithChainedTaskUpload());
    const chains = await listEventDeliverableFiles(db, "event-1");
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({
      rootFileId: "file-v1",
      latestFileId: "file-v2",
      filename: "slides-v2.pdf",
      kind: "presentation",
      submissionId: "sub-1",
      versionCount: 2,
    });
  });

  it("listSubmissionFiles (backing GET /api/v1/submissions/:id/files) counts both versions under 'presentation'", async () => {
    const db = makeFakeDb(seedWithChainedTaskUpload());
    const grouped = await listSubmissionFiles(db, "sub-1");
    expect(grouped.presentation).toHaveLength(2);
    expect(grouped.presentation?.map((f) => f.id)).toEqual(["file-v2", "file-v1"]);
  });
});
