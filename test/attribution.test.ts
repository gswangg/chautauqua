// DEC-757 coverage (task w4-d): every author is a named person, never a raw
// email/id/the literal "Unknown". Enumerates a fixture with (i) an organizer
// user linked to a contact, (ii) a speaker user linked to a contact, and
// (iii) a user with no contact, across the three call sites DEC-757 names:
// resolveActorName (src/server/repo/users.ts), listFileComments
// (src/server/repo/files-comments.ts), and the submissions revision-history
// write path (src/routes/api/submissions.ts:233/301).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";

// listFileComments (via listFileChainIds) needs eq/inArray to be inspectable
// markers rather than opaque SQL objects — same pattern as
// test/portal-deliverable-panel-repo.test.ts.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ __marker: "eq" as const, col, val }),
    inArray: (col: unknown, vals: unknown[]) => ({ __marker: "inArray" as const, col, vals }),
  };
});

const { resolveActorName } = await import("../src/server/repo/users");
const { listFileComments } = await import("../src/server/repo/files-comments");
const { submissionsRoutes } = await import("../src/routes/api/submissions");
const { registerErrorHandler } = await import("../src/server/http");

// ---------------------------------------------------------------------------
// Fixture: three actors enumerated by every test below.
// ---------------------------------------------------------------------------

const ORGANIZER_WITH_CONTACT = {
  userId: "u-organizer",
  email: "organizer@example.com",
  contactId: "contact-organizer",
  contact: { firstName: "Olive", lastName: "Organizer" },
};
const SPEAKER_WITH_CONTACT = {
  userId: "u-speaker",
  email: "speaker@example.com",
  contactId: "contact-speaker",
  contact: { firstName: "Sam", lastName: "Speaker" },
};
const USER_NO_CONTACT = {
  userId: "u-no-contact",
  email: "nocontact@example.com",
  contactId: null as string | null,
  contact: null,
};

const ACTORS = [ORGANIZER_WITH_CONTACT, SPEAKER_WITH_CONTACT, USER_NO_CONTACT];

// ---------------------------------------------------------------------------
// Queue-fake db (mirrors test/submission-revisions.test.ts's pattern: no
// wrangler/D1 harness exists in stage 1 unit tests) for resolveActorName and
// the PATCH /submissions/:id route test below.
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
      leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function queueDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: unknown[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    update: () => ({ set: () => ({ where: async () => {} }) }),
    insert: () => ({
      values: async (vals: unknown) => {
        inserts.push(vals);
      },
    }),
  };
  return { db: db as unknown as Db, inserts };
}

describe("resolveActorName (DEC-757)", () => {
  it("returns 'First Last' for a user with a linked contact", async () => {
    for (const actor of [ORGANIZER_WITH_CONTACT, SPEAKER_WITH_CONTACT]) {
      const { db } = queueDb([
        [{ email: actor.email, contactId: actor.contactId }],
        [actor.contact],
      ]);
      const name = await resolveActorName(db, actor.userId);
      expect(name).toBe(`${actor.contact!.firstName} ${actor.contact!.lastName}`);
      expect(name).not.toContain("@");
    }
  });

  it("falls back to the user's email when there is no linked contact", async () => {
    const { db } = queueDb([[{ email: USER_NO_CONTACT.email, contactId: null }]]);
    const name = await resolveActorName(db, USER_NO_CONTACT.userId);
    expect(name).toBe(USER_NO_CONTACT.email);
  });

  it("throws (fail loudly) rather than falling back to the raw id when the user row is missing", async () => {
    const { db } = queueDb([[]]);
    await expect(resolveActorName(db, "ghost-user")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// listFileComments: chain-aware fake DB (pattern from
// test/portal-deliverable-panel-repo.test.ts) with real tables, one comment
// per fixture actor plus a comment carrying its own authorContactId distinct
// from the author user's linked contact.
// ---------------------------------------------------------------------------

type Marker = { __marker: "eq"; col: unknown; val: unknown } | { __marker: "inArray"; col: unknown; vals: unknown[] };

function colKeyIn(tableObj: object, col: unknown): string | undefined {
  return Object.entries(tableObj).find(([, v]) => v === col)?.[0];
}

type TableKey = "file" | "fileComment" | "user" | "contact";
const TABLE_SCHEMAS: Record<TableKey, object> = {
  file: schema.file,
  fileComment: schema.fileComment,
  user: schema.user,
  contact: schema.contact,
};
function tableKeyFor(tableRef: unknown): TableKey {
  for (const [key, obj] of Object.entries(TABLE_SCHEMAS)) {
    if (obj === tableRef) return key as TableKey;
  }
  throw new Error("fake db: unknown table reference");
}

function collectMarkerValues(cond: unknown, key: string, schemaObj: object): unknown[] {
  const marker = cond as Marker;
  const col = colKeyIn(schemaObj, marker.col);
  if (!col || col !== key) return [];
  return marker.__marker === "eq" ? [marker.val] : (marker as { vals: unknown[] }).vals;
}

function makeChainDb(data: Record<TableKey, Record<string, unknown>[]>) {
  return {
    select(fields?: Record<string, unknown>) {
      let tableRef: unknown;
      let whereCond: Marker | null = null;
      const run = () => {
        const key = tableKeyFor(tableRef);
        const schemaObj = TABLE_SCHEMAS[key];
        let rows = data[key];
        if (whereCond) {
          const idCol = colKeyIn(schemaObj, (whereCond as Marker).col) ?? "id";
          const vals = collectMarkerValues(whereCond, idCol, schemaObj);
          rows = rows.filter((r) => vals.includes(r[idCol]));
        }
        if (fields && "count" in fields) return [{ count: rows.length }];
        if (!fields) return rows.map((r) => ({ ...r }));
        return rows.map((r) => {
          const out: Record<string, unknown> = {};
          for (const [outKey, col] of Object.entries(fields)) {
            const k = colKeyIn(schemaObj, col);
            out[outKey] = k ? r[k] : undefined;
          }
          return out;
        });
      };
      const chain: any = {
        from: (t: unknown) => {
          tableRef = t;
          return chain;
        },
        where: (cond: Marker) => {
          whereCond = cond;
          return chain;
        },
        orderBy: () => chain,
        limit: (n: number) => ({
          offset: (m: number) => run().slice(m, m + n),
          then: (resolve: (v: unknown[]) => void, reject: (e: unknown) => void) => {
            try {
              resolve(run().slice(0, n));
            } catch (e) {
              reject(e);
            }
          },
        }),
        then: (resolve: (v: unknown[]) => void, reject: (e: unknown) => void) => {
          try {
            resolve(run());
          } catch (e) {
            reject(e);
          }
        },
      };
      return chain;
    },
  } as unknown as Db;
}

describe("listFileComments (DEC-757: no comment's authorName is a raw email or 'Unknown')", () => {
  it("resolves every actor's contact name, and 'Unknown' never appears", async () => {
    const fileId = "file-1";
    const db = makeChainDb({
      file: [{ id: fileId, previousFileId: null, versionNo: 1, filename: "f.pdf", contentType: "application/pdf", r2Key: "k", createdAt: new Date(1000) }],
      fileComment: ACTORS.map((actor, i) => ({
        id: `c${i}`,
        fileId,
        authorUserId: actor.userId,
        authorContactId: null, // resolved via the author user's own contact
        body: `comment from ${actor.userId}`,
        createdAt: new Date(2000 + i),
      })),
      user: ACTORS.map((a) => ({ id: a.userId, email: a.email, role: "organizer", contactId: a.contactId })),
      contact: [ORGANIZER_WITH_CONTACT, SPEAKER_WITH_CONTACT]
        .filter((a) => a.contactId)
        .map((a) => ({ id: a.contactId, firstName: a.contact!.firstName, lastName: a.contact!.lastName })),
    });

    const result = await listFileComments(db, fileId);
    expect(result.items).toHaveLength(3);
    const byActor = new Map(result.items.map((r) => [r.body, r.authorName]));

    expect(byActor.get(`comment from ${ORGANIZER_WITH_CONTACT.userId}`)).toBe("Olive Organizer");
    expect(byActor.get(`comment from ${SPEAKER_WITH_CONTACT.userId}`)).toBe("Sam Speaker");
    expect(byActor.get(`comment from ${USER_NO_CONTACT.userId}`)).toBe(USER_NO_CONTACT.email);

    for (const item of result.items) {
      expect(item.authorName).not.toBe("Unknown");
      expect(item.authorName.toLowerCase()).not.toContain("unknown");
    }
    // A named contact never leaks the raw email address.
    expect(byActor.get(`comment from ${ORGANIZER_WITH_CONTACT.userId}`)).not.toContain("@");
    expect(byActor.get(`comment from ${SPEAKER_WITH_CONTACT.userId}`)).not.toContain("@");
  });

  it("prefers the comment's OWN authorContactId over the author user's linked contact", async () => {
    const fileId = "file-2";
    const db = makeChainDb({
      file: [{ id: fileId, previousFileId: null, versionNo: 1, filename: "f.pdf", contentType: "application/pdf", r2Key: "k", createdAt: new Date(1000) }],
      fileComment: [
        {
          id: "c-own",
          fileId,
          authorUserId: ORGANIZER_WITH_CONTACT.userId,
          authorContactId: "contact-snapshot",
          body: "snapshot comment",
          createdAt: new Date(3000),
        },
      ],
      user: [{ id: ORGANIZER_WITH_CONTACT.userId, email: ORGANIZER_WITH_CONTACT.email, role: "organizer", contactId: ORGANIZER_WITH_CONTACT.contactId }],
      contact: [
        { id: ORGANIZER_WITH_CONTACT.contactId, firstName: "Olive", lastName: "Organizer" },
        { id: "contact-snapshot", firstName: "Snap", lastName: "Shot" },
      ],
    });

    const result = await listFileComments(db, fileId);
    expect(result.items[0]?.authorName).toBe("Snap Shot");
  });

  it("throws rather than resolving role 'unknown' when the author user cannot be found", async () => {
    const fileId = "file-3";
    const db = makeChainDb({
      file: [{ id: fileId, previousFileId: null, versionNo: 1, filename: "f.pdf", contentType: "application/pdf", r2Key: "k", createdAt: new Date(1000) }],
      fileComment: [
        {
          id: "c-ghost",
          fileId,
          authorUserId: "ghost-user",
          authorContactId: null,
          body: "orphaned comment",
          createdAt: new Date(4000),
        },
      ],
      user: [],
      contact: [],
    });

    await expect(listFileComments(db, fileId)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/submissions/:id — the revision row's editorName must be the
// editor's display name (via resolveActorName), never their raw address, so
// it matches the portal-edit path's real-name convention.
// ---------------------------------------------------------------------------

function appWithDbAndAuth(db: Db, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", submissionsRoutes);
  return app;
}

const ORG_A = "org-a";
const SUBMISSION_ORG_A = { eventId: "event-1", orgId: ORG_A };
const DETAIL_ROW = {
  id: "sub-1",
  eventId: "event-1",
  formId: null,
  seq: 1,
  title: "T",
  description: "D",
  trackId: null,
  status: "pending",
  contentStatus: "pending",
  acceptedAt: null,
  icsSequence: 0,
  createdAt: new Date(1000),
  updatedAt: new Date(2000),
  recordPrefix: "TALK",
  orgId: ORG_A,
  startDate: "2024-01-01",
};

describe("PATCH /api/v1/submissions/:id — revision editorName (DEC-757)", () => {
  it("stores the editor's display name, not their email, when the editor has a linked contact", async () => {
    const editor = ORGANIZER_WITH_CONTACT;
    const { db, inserts } = queueDb([
      [SUBMISSION_ORG_A], // getSubmissionOwnership
      [{ title: "Old Title", description: "Old description" }], // getSubmissionContent (before)
      // DEC-155 (wave-60): resolveActorName is hoisted into the PATCH's ONE
      // pre-write read wave, so it is issued BEFORE ensureBaselineRevision's
      // countRevisions (which runs in the write phase, after the wave).
      [{ email: editor.email, contactId: editor.contactId }], // resolveActorName: user
      [editor.contact], // resolveActorName: contact
      [{ count: 1 }], // countRevisions (ensureBaselineRevision, DEC-158 wave-59: already has revisions)
      [{ ...DETAIL_ROW, title: "New Title" }], // getSubmissionDetail
      [], // participants
      [], // tracks
      [], // answers
    ]);
    const auth: AuthInfo = { userId: editor.userId, role: "organizer", orgId: ORG_A };
    const res = await appWithDbAndAuth(db, auth).request(
      new Request("http://local/api/v1/submissions/sub-1", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-chq-csrf": "1" },
        body: JSON.stringify({ title: "New Title" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(inserts).toHaveLength(1);
    expect((inserts[0] as any).editorName).toBe("Olive Organizer");
    expect((inserts[0] as any).editorName).not.toContain("@");
  });
});
