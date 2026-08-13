// DEC-713 repo coverage for deleting a file version: the chain re-links
// across the gap in ONE statement (a middle deletion must never fork the
// chain, DEC-244/573), the deleted row's comment thread re-homes onto the
// surviving neighbour with a system note recorded, and getFileDeleteScope
// surfaces exactly what the DELETE route's authz needs. This repo has no
// local sqlite/D1 test driver (see test/files-repo.test.ts's sibling
// comment) — the fake db below dispatches on the real schema table objects
// passed to .from()/.update()/.insert()/.delete() and interprets the
// drizzle condition tree well enough to filter/mutate an in-memory table set.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { deleteFileVersion, getFileDeleteScope } from "../src/server/repo/files-versions";
import type { Db } from "../src/server/context";

function collectLiteralValues(node: unknown, seen = new Set<unknown>(), out: Set<string> = new Set()): Set<string> {
  if (typeof node === "string") {
    out.add(node);
    return out;
  }
  if (node === null || typeof node !== "object" || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const c of node) collectLiteralValues(c, seen, out);
    return out;
  }
  const n = node as Record<string, unknown>;
  if (typeof n.value === "string") out.add(n.value);
  if (Array.isArray(n.queryChunks)) collectLiteralValues(n.queryChunks, seen, out);
  return out;
}

interface FileRow {
  id: string;
  submissionId: string | null;
  filename: string;
  r2Key: string;
  previousFileId: string | null;
  versionNo: number;
  uploadedByContactId: string | null;
}
interface CommentRow {
  id: string;
  fileId: string;
  authorUserId: string | null;
  authorContactId: string | null;
  body: string;
  createdAt: Date;
}
interface SubmissionRow {
  id: string;
  eventId: string;
  contentStatus: string;
  /** DEC-041: the delete route's edit lock needs submission status + the
   * owning form's close date in the same round trip as the org/content read. */
  status: string;
  formId: string | null;
}
interface EventRow {
  id: string;
  orgId: string;
  timezone: string;
}
interface FormRow {
  id: string;
  closeDate: Date | null;
}
/** DEC-926: deleteFileVersion re-homes (never deletes) task_assignment rows
 * that point at the deleted file, so the fake has to model that table too. */
interface AssignmentRow {
  id: string;
  status: string;
  completedAt: Date | null;
  completedBy: string | null;
  fileId: string | null;
}

function makeFakeDb(state: {
  files: FileRow[];
  comments: CommentRow[];
  submissions: SubmissionRow[];
  events: EventRow[];
  assignments: AssignmentRow[];
  forms?: FormRow[];
}) {
  const forms = state.forms ?? [];
  const calls: { op: "insert" | "update" | "delete"; table: string; detail: unknown }[] = [];

  const db = {
    select(proj: Record<string, unknown>) {
      const keys = Object.keys(proj);
      return {
        from(table: unknown) {
          if (table === schema.file) {
            return {
              where(cond: unknown) {
                const literals = collectLiteralValues(cond);
                return {
                  limit: async () => {
                    if (keys.length === 1 && keys[0] === "id") {
                      // successor lookup: WHERE previous_file_id = <literal>
                      const row = state.files.find((f) => f.previousFileId && literals.has(f.previousFileId));
                      return row ? [{ id: row.id }] : [];
                    }
                    if (keys.length === 1 && keys[0] === "previousFileId") {
                      // version-walk: WHERE id = <literal>
                      const row = state.files.find((f) => literals.has(f.id));
                      return row ? [{ previousFileId: row.previousFileId }] : [];
                    }
                    // multi-column row-by-id fetch
                    const row = state.files.find((f) => literals.has(f.id));
                    if (!row) return [];
                    const out: Record<string, unknown> = {};
                    for (const k of keys) out[k] = (row as unknown as Record<string, unknown>)[k];
                    return [out];
                  },
                };
              },
            };
          }
          if (table === schema.submission) {
            return {
              innerJoin(_eventTable: unknown, _cond: unknown) {
                // submission INNER JOIN event LEFT JOIN form: the form side is
                // optional, so a submission with no form still yields a row.
                const joined = {
                  where(cond: unknown) {
                    const literals = collectLiteralValues(cond);
                    return {
                      limit: async () => {
                        const sub = state.submissions.find((s) => literals.has(s.id));
                        if (!sub) return [];
                        const ev = state.events.find((e) => e.id === sub.eventId);
                        if (!ev) return [];
                        const form = sub.formId ? forms.find((f) => f.id === sub.formId) : undefined;
                        return [
                          {
                            eventId: sub.eventId,
                            orgId: ev.orgId,
                            contentStatus: sub.contentStatus,
                            status: sub.status,
                            formCloseDate: form?.closeDate ?? null,
                            timezone: ev.timezone,
                          },
                        ];
                      },
                    };
                  },
                  leftJoin(_formTable: unknown, _formCond: unknown) {
                    return joined;
                  },
                };
                return joined;
              },
            };
          }
          throw new Error("unexpected table in fake select");
        },
      };
    },
    update(table: unknown) {
      if (table === schema.file) {
        return {
          set(values: { previousFileId: string | null }) {
            return {
              async where(cond: unknown) {
                const literals = collectLiteralValues(cond);
                const targets = state.files.filter((f) => f.previousFileId && literals.has(f.previousFileId));
                for (const t of targets) t.previousFileId = values.previousFileId;
                calls.push({ op: "update", table: "file", detail: { values, matched: targets.map((t) => t.id) } });
              },
            };
          },
        };
      }
      if (table === schema.fileComment) {
        return {
          set(values: { fileId: string }) {
            return {
              async where(cond: unknown) {
                const literals = collectLiteralValues(cond);
                const targets = state.comments.filter((c) => literals.has(c.fileId));
                for (const t of targets) t.fileId = values.fileId;
                calls.push({ op: "update", table: "fileComment", detail: { values, matched: targets.map((t) => t.id) } });
              },
            };
          },
        };
      }
      if (table === schema.taskAssignment) {
        return {
          set(values: Partial<AssignmentRow> & { updatedAt?: Date }) {
            return {
              async where(cond: unknown) {
                // set-based: WHERE file_id = <deleted id>
                const literals = collectLiteralValues(cond);
                const targets = state.assignments.filter((a) => a.fileId !== null && literals.has(a.fileId));
                for (const t of targets) {
                  if ("fileId" in values) t.fileId = values.fileId ?? null;
                  if ("status" in values) t.status = values.status!;
                  if ("completedAt" in values) t.completedAt = values.completedAt ?? null;
                  if ("completedBy" in values) t.completedBy = values.completedBy ?? null;
                }
                calls.push({ op: "update", table: "taskAssignment", detail: { values, matched: targets.map((t) => t.id) } });
              },
            };
          },
        };
      }
      throw new Error("unexpected table in fake update");
    },
    insert(table: unknown) {
      if (table === schema.fileComment) {
        return {
          async values(row: CommentRow) {
            state.comments.push(row);
            calls.push({ op: "insert", table: "fileComment", detail: row });
          },
        };
      }
      throw new Error("unexpected table in fake insert");
    },
    delete(table: unknown) {
      if (table === schema.file) {
        return {
          async where(cond: unknown) {
            const literals = collectLiteralValues(cond);
            const before = state.files.length;
            state.files = state.files.filter((f) => !literals.has(f.id));
            calls.push({ op: "delete", table: "file", detail: { removed: before - state.files.length } });
          },
        };
      }
      if (table === schema.fileComment) {
        return {
          async where(cond: unknown) {
            const literals = collectLiteralValues(cond);
            const before = state.comments.length;
            state.comments = state.comments.filter((c) => !literals.has(c.fileId));
            calls.push({ op: "delete", table: "fileComment", detail: { removed: before - state.comments.length } });
          },
        };
      }
      throw new Error("unexpected table in fake delete");
    },
  };
  return { db: db as unknown as Db, state, calls };
}

function chain() {
  // v1 (root) -> v2 (middle) -> v3 (latest)
  const files: FileRow[] = [
    { id: "v1", submissionId: "sub1", filename: "deck-v1.pdf", r2Key: "sub/sub1/v1.pdf", previousFileId: null, versionNo: 1, uploadedByContactId: "c1" },
    { id: "v2", submissionId: "sub1", filename: "deck-v2.pdf", r2Key: "sub/sub1/v2.pdf", previousFileId: "v1", versionNo: 2, uploadedByContactId: "c1" },
    { id: "v3", submissionId: "sub1", filename: "deck-v3.pdf", r2Key: "sub/sub1/v3.pdf", previousFileId: "v2", versionNo: 3, uploadedByContactId: "c1" },
  ];
  const comments: CommentRow[] = [
    { id: "cm1", fileId: "v2", authorUserId: "u1", authorContactId: null, body: "looks good", createdAt: new Date(1000) },
    { id: "cm2", fileId: "v2", authorUserId: "u1", authorContactId: null, body: "one more pass", createdAt: new Date(2000) },
  ];
  const submissions: SubmissionRow[] = [
    { id: "sub1", eventId: "ev1", contentStatus: "pending", status: "accepted", formId: "form1" },
  ];
  const events: EventRow[] = [{ id: "ev1", orgId: "org1", timezone: "America/New_York" }];
  const forms: FormRow[] = [{ id: "form1", closeDate: new Date(90_000) }];
  // completed assignment linked to the middle version (v2)
  const assignments: AssignmentRow[] = [
    { id: "asg1", status: "complete", completedAt: new Date(5000), completedBy: "c1", fileId: "v2" },
  ];
  return { files, comments, submissions, events, assignments, forms };
}

describe("deleteFileVersion (DEC-713)", () => {
  it("re-links a middle-of-chain deletion in one statement — v3 now points at v1, never forking", async () => {
    const { db, state, calls } = makeFakeDb(chain());

    await deleteFileVersion(db, { fileId: "v2", deletedByUserId: "organizer-1", deletedByContactId: null });

    const v3 = state.files.find((f) => f.id === "v3");
    expect(v3?.previousFileId).toBe("v1");
    expect(state.files.find((f) => f.id === "v2")).toBeUndefined();

    const relinkCall = calls.find((c) => c.op === "update" && c.table === "file");
    expect(relinkCall).toBeDefined();
    expect((relinkCall!.detail as { matched: string[] }).matched).toEqual(["v3"]);
  });

  it("re-homes the deleted version's comments onto the surviving successor (the row that takes its place)", async () => {
    const { db, state } = makeFakeDb(chain());

    await deleteFileVersion(db, { fileId: "v2", deletedByUserId: "organizer-1", deletedByContactId: null });

    const movedComments = state.comments.filter((c) => c.id === "cm1" || c.id === "cm2");
    expect(movedComments).toHaveLength(2);
    for (const c of movedComments) expect(c.fileId).toBe("v3");
  });

  it("appends a system comment naming the removed version, authored by the deleting user", async () => {
    const { db, state } = makeFakeDb(chain());

    await deleteFileVersion(db, { fileId: "v2", deletedByUserId: "organizer-1", deletedByContactId: "contact-9" });

    const systemComment = state.comments.find((c) => c.body.startsWith("Removed version"));
    expect(systemComment).toBeDefined();
    expect(systemComment!.body).toBe("Removed version 2 - deck-v2.pdf");
    expect(systemComment!.fileId).toBe("v3");
    expect(systemComment!.authorUserId).toBe("organizer-1");
    expect(systemComment!.authorContactId).toBe("contact-9");
  });

  it("deletes the latest version (no successor) by re-homing its comments onto the predecessor", async () => {
    const fixture = chain();
    fixture.comments.push({ id: "cm3", fileId: "v3", authorUserId: "u2", authorContactId: null, body: "final review", createdAt: new Date(3000) });
    const { db, state } = makeFakeDb(fixture);

    await deleteFileVersion(db, { fileId: "v3", deletedByUserId: "organizer-1", deletedByContactId: null });

    expect(state.files.find((f) => f.id === "v3")).toBeUndefined();
    const moved = state.comments.find((c) => c.id === "cm3");
    expect(moved?.fileId).toBe("v2");
    const systemComment = state.comments.find((c) => c.body.startsWith("Removed version"));
    expect(systemComment?.fileId).toBe("v2");
  });

  it("removes comments along with the file when it is the sole version in its chain", async () => {
    const files: FileRow[] = [
      { id: "solo", submissionId: "sub2", filename: "solo.pdf", r2Key: "sub/sub2/solo.pdf", previousFileId: null, versionNo: 1, uploadedByContactId: "c2" },
    ];
    const comments: CommentRow[] = [
      { id: "cmA", fileId: "solo", authorUserId: "u1", authorContactId: null, body: "hello", createdAt: new Date(1000) },
    ];
    const assignments: AssignmentRow[] = [
      { id: "asgSolo", status: "complete", completedAt: new Date(5000), completedBy: "c2", fileId: "solo" },
    ];
    const { db, state } = makeFakeDb({ files, comments, submissions: [], events: [], assignments });

    await deleteFileVersion(db, { fileId: "solo", deletedByUserId: "organizer-1", deletedByContactId: null });

    expect(state.files).toHaveLength(0);
    expect(state.comments).toHaveLength(0);
  });

  // DEC-926: a linked task_assignment is never deleted with the file — it
  // either follows the chain to the surviving link, or (sole version) reopens.
  it("re-homes a linked task_assignment onto the surviving successor when a middle version is deleted", async () => {
    const { db, state, calls } = makeFakeDb(chain());

    await deleteFileVersion(db, { fileId: "v2", deletedByUserId: "organizer-1", deletedByContactId: null });

    const asg = state.assignments.find((a) => a.id === "asg1");
    expect(asg).toBeDefined();
    expect(asg!.fileId).toBe("v3");
    // completion state survives its linked file's deletion
    expect(asg!.status).toBe("complete");
    expect(asg!.completedBy).toBe("c1");
    expect(calls.some((c) => c.op === "delete" && c.table === "taskAssignment")).toBe(false);
  });

  it("re-homes a linked task_assignment onto the predecessor when the latest version is deleted", async () => {
    const fixture = chain();
    fixture.assignments[0]!.fileId = "v3";
    const { db, state } = makeFakeDb(fixture);

    await deleteFileVersion(db, { fileId: "v3", deletedByUserId: "organizer-1", deletedByContactId: null });

    const asg = state.assignments.find((a) => a.id === "asg1");
    expect(asg!.fileId).toBe("v2");
    expect(asg!.status).toBe("complete");
  });

  it("reopens the linked task_assignment when the sole version in the chain is deleted", async () => {
    const files: FileRow[] = [
      { id: "solo", submissionId: "sub2", filename: "solo.pdf", r2Key: "sub/sub2/solo.pdf", previousFileId: null, versionNo: 1, uploadedByContactId: "c2" },
    ];
    const assignments: AssignmentRow[] = [
      { id: "asgSolo", status: "complete", completedAt: new Date(5000), completedBy: "c2", fileId: "solo" },
    ];
    const { db, state } = makeFakeDb({ files, comments: [], submissions: [], events: [], assignments });

    await deleteFileVersion(db, { fileId: "solo", deletedByUserId: "organizer-1", deletedByContactId: null });

    const asg = state.assignments.find((a) => a.id === "asgSolo");
    expect(asg).toBeDefined();
    expect(asg!.status).toBe("pending");
    expect(asg!.fileId).toBeNull();
    expect(asg!.completedAt).toBeNull();
    expect(asg!.completedBy).toBeNull();
  });
});

describe("getFileDeleteScope (DEC-713)", () => {
  it("reports org/contentStatus and whether the file is the latest link in its chain", async () => {
    const { db } = makeFakeDb(chain());

    const middle = await getFileDeleteScope(db, "v2");
    expect(middle).toMatchObject({ orgId: "org1", contentStatus: "pending", isLatestInChain: false, uploadedByContactId: "c1" });

    const latest = await getFileDeleteScope(db, "v3");
    expect(latest?.isLatestInChain).toBe(true);
  });

  // DEC-041 (wave-46): the DELETE route decides the edit lock from this one
  // read, so the scope must carry submission status + form close date + tz.
  it("carries the submission status, form close date and event timezone the edit lock needs", async () => {
    const { db } = makeFakeDb(chain());

    const scope = await getFileDeleteScope(db, "v3");
    expect(scope).toMatchObject({
      status: "accepted",
      formCloseDate: 90_000,
      timezone: "America/New_York",
    });
  });

  it("returns null for an unknown file id", async () => {
    const { db } = makeFakeDb(chain());
    expect(await getFileDeleteScope(db, "nope")).toBeNull();
  });
});
