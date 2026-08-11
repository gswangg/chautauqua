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

  it("disallowed extension: re-renders /portal/tasks inline with a clear on-screen error, not the raw JSON error envelope", async () => {
    // Regression for a real browser-verified defect (task w3-c, J8 content
    // lifecycle pass): a disallowed-extension/over-cap upload used to throw
    // ApiError straight to the global onError handler, so a full-page form
    // POST landed the browser on an unstyled `{"error":{...}}` JSON blob at
    // POST's own URL instead of redisplaying My Tasks with an inline error.
    const { getAssignmentScope } = await import("../src/server/repo/portal");
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
    const portalRepo = await import("../src/server/repo/portal");
    vi.spyOn(portalRepo, "getPortalData").mockResolvedValue({
      branding: { eventName: "Test Event", welcomeMessage: null, accentColor: null, logoUrl: null },
    } as never);
    vi.spyOn(portalRepo, "getMyTaskAssignments").mockResolvedValue([
      {
        id: ASSIGNMENT_ID,
        title: "Finalize slides",
        description: null,
        required: true,
        dueDate: null,
        status: "pending",
        kind: "file_request",
        formId: null,
        fileId: null,
        responseJson: null,
      } as never,
    ]);

    const app = await buildPortalApp(SPEAKER);
    const form = new FormData();
    form.set("chq_csrf", "tok-bad-ext");
    form.set("file", new File(["not a real deliverable"], "malware.exe", { type: "application/octet-stream" }));
    const res = await app.request(
      new Request(`http://test.local/portal/tasks/${ASSIGNMENT_ID}/upload`, {
        method: "POST",
        headers: { cookie: "chq_csrf=tok-bad-ext" },
        body: form,
      }),
    );

    // Same URL family (no redirect), 400, HTML — never the JSON envelope.
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).not.toContain('"error":{"code"');
    expect(html).toContain("My Tasks");
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/isn(&#39;|')t allowed|not an accepted/i);
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
  | { __marker: "inArray"; col: unknown; vals: unknown[] }
  | { __marker: "isNull"; col: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
    isNull: (col: unknown): Marker => ({ __marker: "isNull", col }),
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

function isColumnRef(x: unknown): boolean {
  for (const tableObj of Object.values(TABLE_SCHEMAS)) {
    for (const value of Object.values(tableObj)) {
      if (value === x) return true;
    }
  }
  return false;
}

function isSqlNode(x: unknown): x is { queryChunks: unknown[] } {
  return typeof x === "object" && x !== null && "queryChunks" in (x as Record<string, unknown>);
}

function evalCond(cond: unknown, row: Record<string, unknown>): boolean {
  const m = cond as Marker;
  if (m.__marker === "eq") {
    const right = isColumnRef(m.val) ? row[colKey(m.val)] : m.val;
    return row[colKey(m.col)] === right;
  }
  if (m.__marker === "and") return m.conds.every((c) => evalCond(c, row));
  if (m.__marker === "inArray") return m.vals.includes(row[colKey(m.col)]);
  if (m.__marker === "isNull") return row[colKey(m.col)] == null;
  throw new Error(`fake db: unsupported condition ${JSON.stringify(cond)}`);
}

/** Resolves a join predicate's column operand against whichever of the two
 * joined tables actually declares it — avoids the "id" key collision a
 * naive object merge would hit (every table's PK is named "id"). */
function evalJoinCond(
  cond: unknown,
  sRow: Record<string, unknown>,
  jRow: Record<string, unknown>,
  sTable: Record<string, unknown>,
  jTable: Record<string, unknown>,
): boolean {
  const m = cond as Marker;
  if (m.__marker !== "eq") throw new Error("fake db: only eq join predicates supported");
  const resolve = (col: unknown) => {
    if (Object.values(sTable).includes(col)) return sRow[colKey(col)];
    if (Object.values(jTable).includes(col)) return jRow[colKey(col)];
    throw new Error("fake db: join predicate column not found on either joined table");
  };
  return resolve(m.col) === resolve(m.val);
}

function project(row: Record<string, unknown>, fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [outKey, col] of Object.entries(fields)) {
    out[outKey] = isColumnRef(col) ? row[colKey(col)] : row[outKey];
  }
  return out;
}

function isCountStarFields(fields: Record<string, unknown> | undefined): boolean {
  if (!fields || Object.keys(fields).length !== 1) return false;
  return isSqlNode(fields.count);
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
      let fromTable: Record<string, unknown> | null = null;
      let whereCond: unknown = null;
      let orderDesc = false;
      let limitN: number | undefined;
      let offsetN = 0;
      const run = () => {
        const matched = whereCond ? source.filter((r) => evalCond(whereCond, r)) : source.slice();
        if (isCountStarFields(fields)) return [{ count: matched.length }];
        let filtered = matched;
        if (orderDesc) {
          filtered = filtered.slice().sort((a, b) => {
            const av = (a.createdAt as Date).getTime();
            const bv = (b.createdAt as Date).getTime();
            return bv - av;
          });
        }
        if (offsetN) filtered = filtered.slice(offsetN);
        if (limitN !== undefined) filtered = filtered.slice(0, limitN);
        return fields ? filtered.map((r) => project(r, fields)) : filtered.map((r) => ({ ...r }));
      };
      const chain: any = {
        from: (table: Record<string, unknown>) => {
          fromTable = table;
          source = (byTable.get(table) ?? []).map((r) => ({ ...r }));
          return chain;
        },
        innerJoin: (table: Record<string, unknown>, cond: unknown) => {
          const joinRows = byTable.get(table) ?? [];
          const sTable = fromTable!;
          const merged: Record<string, unknown>[] = [];
          for (const s of source) {
            for (const j of joinRows) {
              if (evalJoinCond(cond, s, j, sTable, table)) {
                // s (the driving/"from" table) wins on key collisions (every
                // table's PK is literally "id").
                merged.push({ ...j, ...s });
              }
            }
          }
          source = merged;
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
        limit: (n: number) => {
          limitN = n;
          return chain;
        },
        offset: (n: number) => {
          offsetN = n;
          return chain;
        },
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
    const result = await listEventDeliverableFiles(db, "event-1", { page: 1, perPage: 50, kinds: [], q: null });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
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
