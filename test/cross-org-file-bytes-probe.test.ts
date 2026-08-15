// DEC-459/DEC-550 (task w37-d): the enumerated wrong-ORG probe for every
// route that STREAMS STORED BYTES (a real R2 object body, not a JSON
// summary). Every sibling ownership probe already in this repo either
// varies the ROLE (test/role-refusal-probe.test.ts), the absence of a
// session (test/anonymous-*-probe.test.ts), or the OWNER within the SAME
// org (test/portal-idor-probe.test.ts, whose ownership resolvers are
// MOCKED per its own header comment). None of them drives a byte-streaming
// route with a foreign ORG's real row ids against a REAL database, and none
// of them asserts the second DEC-550 signal this task adds: the object
// store itself must never even be ASKED for a foreign key, because a
// leaked byte stream can't be un-sent once store.get() has answered.
//
// Population, derived not hand-listed: enumerateRegisteredRoutes()
// (test/helpers/registered-routes.ts) already parses every `.get/.post(...)`
// registration, file+line, out of source. This file filters that table down
// to the four files this task names (src/routes/files.ts,
// src/routes/portal/tasks.tsx, src/routes/portal/tasks/resources.tsx,
// src/routes/portal/profile.tsx), then re-slices each candidate file's own
// source text between one registration and the next (or EOF) and keeps only
// the ones whose handler body literally calls `store.get(` — a
// byte-streaming handler is never anything else in this codebase (every
// c.body(obj.body, ...) response is preceded by exactly one store.get()).
// EXPECTED_POPULATION below is asserted equal to that derived set in BOTH
// directions (test 1) so a future byte route added to one of these four
// files, or one of the ledgered routes moved/renamed, fails loudly here
// instead of silently narrowing the probe.
//
// Technique: REAL rows over a real in-memory SQLite engine (node:sqlite +
// drizzle-orm/sqlite-proxy, same as test/rate-limit-atomicity.test.ts /
// test/file-version-delete-task-assignment.test.ts) — per the field guide
// ("A MOCKED RESOLVER PROVES THE ROUTE CALLS IT, NOT THAT IT FILTERS"),
// every ownership resolver these routes call (getFileScope/getSubmissionScope,
// getEventFilesScope, getAssignmentScope, getResourceDownloadScope,
// getHeadshotServeScope) runs for real against real org-A/org-B rows, never
// mocked. Composition is parseIndexMounts() + registerErrorHandler, the same
// technique test/anonymous-route-probe.test.ts and
// test/portal-idor-probe.test.ts use, so every route's own middleware chain
// (requireOrganizer/speakerGate/csrfJson) runs for real too.
//
// DEC-550 second signal: FILES is a stub whose get(key) RECORDS the
// requested key and then THROWS — never resolves with bytes. If a route's
// authz were ever bypassed, this stub turns what would be a silent 200-with-
// bytes leak into an uncaught throw (a loud, obvious 500 the ledger asserts
// against), and the throw's `recorded` side effect is the load-bearing
// evidence: at the end of the whole sweep, zero org-A keys must ever have
// been recorded, on ANY route, even the ones this probe expects to refuse
// well before reaching the store.
//
// Fixture: org A owns event-a with a submission (file-sub-a, a real
// version), a task_assignment (assignment-a) whose file_request chain has a
// v1+v2 version pair (file-task-a-v1 -> file-task-a-v2), a file-kind
// resource (resource-a/file-resource-a), and a contact (contact-a) with a
// headshot (file-headshot-a) that is NOT publicly visible (its only
// submission is 'pending', so visibleSubmissionConditions() is false) —
// this is deliberate: it is what makes GET /headshots/:fileId's wrong-org
// case a 404 refusal rather than a legitimately-public 200. Org B has an
// organizer (probe-organizer-b) and a speaker (probe-speaker-b,
// contact-b) — actor per route is whichever role legitimately reaches that
// route (files.ts routes: organizer; portal routes: speaker), always the
// org-B identity, always driving one of org A's real ids.
//
// Findings from building this probe (wave 37): none — every one of the 6
// enumerated byte routes already resolves its ownership scope (org id
// and/or contact id match) from a REAL row lookup strictly before the
// `makeFileStore(...).get(...)` call in its own handler body (see each
// route's own file for the exact call order), so every wrong-org request in
// this sweep refuses at its ledgered 403/404 with the FILES stub never
// invoked. No src/routes/** file changed.

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { parseIndexMounts } from "./helpers/index-mounts";
import { enumerateRegisteredRoutes, type RegisteredRoute } from "./helpers/registered-routes";

// ---------------------------------------------------------------------------
// Real in-memory SQLite engine — only the tables these 6 routes' ownership
// resolvers actually query (drizzle-orm/sqlite-proxy driver, same technique
// as test/rate-limit-atomicity.test.ts:19-64 /
// test/file-version-delete-task-assignment.test.ts).
// ---------------------------------------------------------------------------

const DDL = `
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  location text,
  timezone text,
  record_prefix text,
  branding_json text,
  created_at integer,
  updated_at integer
);
create table form (
  id text primary key,
  event_id text,
  title text,
  description text,
  is_default integer,
  open_date integer,
  close_date integer,
  tracks_json text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  form_id text,
  seq integer,
  title text,
  description text,
  track_id text,
  additional_track_ids_json text,
  status text,
  content_status text,
  accepted_at integer,
  ics_sequence integer,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  invite_status text,
  title_at_time text,
  org_at_time text,
  name_at_time text,
  created_at integer,
  updated_at integer
);
create table task (
  id text primary key,
  event_id text,
  kind text,
  title text,
  description text,
  due_date integer,
  required integer,
  form_id text,
  deliverable_kind text,
  instructions text,
  created_at integer,
  updated_at integer
);
create table task_assignment (
  id text primary key,
  task_id text,
  contact_id text,
  status text,
  completed_at integer,
  completed_by text,
  response_json text,
  file_id text,
  last_reminded_at integer,
  created_at integer,
  updated_at integer
);
create table resource (
  id text primary key,
  event_id text,
  kind text,
  title text,
  content text,
  file_id text,
  position integer,
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
  previous_file_id text,
  version_no integer,
  uploaded_by_contact_id text,
  task_assignment_id text,
  created_at integer,
  updated_at integer
);
create table contact (
  id text primary key,
  org_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  title text,
  bio text,
  headshot_url text,
  headshot_file_id text,
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
  created_at integer,
  updated_at integer
);
`;

function makeSqliteDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return { db: db as unknown as Db, sqlite };
}

// ---------------------------------------------------------------------------
// Fixture ids — org A owns every real row, org B's actors probe them.
// ---------------------------------------------------------------------------

const ORG_A = "org-a";
const ORG_B = "org-b";
const EVENT_A = "event-a";
const CONTACT_A = "contact-a";
const CONTACT_B = "contact-b";
const SUBMISSION_A = "submission-a";
const PARTICIPANT_A = "participant-a";
const FILE_SUB_A = "file-sub-a"; // submission deliverable, streamed by GET /files/:fileId + archive
const TASK_A = "task-a";
const ASSIGNMENT_A = "assignment-a";
const FILE_TASK_A_V1 = "file-task-a-v1";
const FILE_TASK_A_V2 = "file-task-a-v2"; // chain latest, task_assignment.file_id
const RESOURCE_A = "resource-a";
const FILE_RESOURCE_A = "file-resource-a";
const FILE_HEADSHOT_A = "file-headshot-a";

const R2_KEY_SUB_A = "org-a/sub/deck.pdf";
const R2_KEY_TASK_A_V1 = "org-a/task/handout-v1.pdf";
const R2_KEY_TASK_A_V2 = "org-a/task/handout-v2.pdf";
const R2_KEY_RESOURCE_A = "org-a/resource/handbook.pdf";
const R2_KEY_HEADSHOT_A = "org-a/headshot/headshot.jpg";

const ORG_A_KEYS = new Set([R2_KEY_SUB_A, R2_KEY_TASK_A_V1, R2_KEY_TASK_A_V2, R2_KEY_RESOURCE_A, R2_KEY_HEADSHOT_A]);

function seedFixtures(sqlite: DatabaseSync): void {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, location, timezone, record_prefix, branding_json, created_at, updated_at)
       values (?, ?, 'Org A Conf', 'org-a-conf', '2026-01-01', '2026-01-02', null, 'America/Los_Angeles', 'SES', null, 0, 0)`,
    )
    .run(EVENT_A, ORG_A);

  sqlite
    .prepare(
      `insert into submission (id, event_id, form_id, seq, title, description, track_id, additional_track_ids_json, status, content_status, accepted_at, ics_sequence, external_ref, created_at, updated_at)
       values (?, ?, null, 1, 'A talk', null, null, null, 'pending', 'pending', null, 0, null, 0, 0)`,
    )
    .run(SUBMISSION_A, EVENT_A);

  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, phone, company, title, bio, headshot_url, social_links_json, notes, custom_fields_json, external_ref, created_at, updated_at)
       values (?, ?, 'Speaker', 'A', 'speaker-a@example.com', null, null, null, null, ?, null, null, null, null, 0, 0)`,
    )
    .run(CONTACT_A, ORG_A, `/headshots/${FILE_HEADSHOT_A}`);

  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, phone, company, title, bio, headshot_url, social_links_json, notes, custom_fields_json, external_ref, created_at, updated_at)
       values (?, ?, 'Speaker', 'B', 'speaker-b@example.com', null, null, null, null, null, null, null, null, null, 0, 0)`,
    )
    .run(CONTACT_B, ORG_B);

  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, title_at_time, org_at_time, name_at_time, created_at, updated_at)
       values (?, ?, ?, 'speaker', 0, 1, 'accepted', null, null, null, 0, 0)`,
    )
    .run(PARTICIPANT_A, SUBMISSION_A, CONTACT_A);

  sqlite
    .prepare(
      `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
       values (?, ?, 'presentation', 'deck.pdf', ?, 100, 'application/pdf', null, 1, ?, null, 0, 0)`,
    )
    .run(FILE_SUB_A, SUBMISSION_A, R2_KEY_SUB_A, CONTACT_A);

  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, description, due_date, required, form_id, deliverable_kind, instructions, created_at, updated_at)
       values (?, ?, 'file_request', 'Upload your handout', null, null, 0, null, null, null, 0, 0)`,
    )
    .run(TASK_A, EVENT_A);

  sqlite
    .prepare(
      `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
       values (?, null, 'handout', 'handout-v1.pdf', ?, 50, 'application/pdf', null, 1, ?, null, 0, 0)`,
    )
    .run(FILE_TASK_A_V1, R2_KEY_TASK_A_V1, CONTACT_A);
  sqlite
    .prepare(
      `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
       values (?, null, 'handout', 'handout-v2.pdf', ?, 60, 'application/pdf', ?, 2, ?, null, 1, 1)`,
    )
    .run(FILE_TASK_A_V2, R2_KEY_TASK_A_V2, FILE_TASK_A_V1, CONTACT_A);

  sqlite
    .prepare(
      `insert into task_assignment (id, task_id, contact_id, status, completed_at, completed_by, response_json, file_id, last_reminded_at, created_at, updated_at)
       values (?, ?, ?, 'completed', 100, ?, null, ?, null, 0, 0)`,
    )
    .run(ASSIGNMENT_A, TASK_A, CONTACT_A, CONTACT_A, FILE_TASK_A_V2);

  sqlite
    .prepare(
      `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
       values (?, null, 'resource', 'handbook.pdf', ?, 70, 'application/pdf', null, 1, null, null, 0, 0)`,
    )
    .run(FILE_RESOURCE_A, R2_KEY_RESOURCE_A);
  sqlite
    .prepare(
      `insert into resource (id, event_id, kind, title, content, file_id, position, created_at, updated_at)
       values (?, ?, 'file', 'Handbook', null, ?, 0, 0, 0)`,
    )
    .run(RESOURCE_A, EVENT_A, FILE_RESOURCE_A);

  sqlite
    .prepare(
      `insert into file (id, submission_id, kind, filename, r2_key, size_bytes, content_type, previous_file_id, version_no, uploaded_by_contact_id, task_assignment_id, created_at, updated_at)
       values (?, null, 'headshot', 'headshot.jpg', ?, 20, 'image/jpeg', null, 1, ?, null, 0, 0)`,
    )
    .run(FILE_HEADSHOT_A, R2_KEY_HEADSHOT_A, CONTACT_A);
}

// ---------------------------------------------------------------------------
// FILES stub — get() records the requested key, then throws (DEC-550): the
// object store must never even be asked for a foreign key.
// ---------------------------------------------------------------------------

function makeRecordingFiles(): { files: R2Bucket; recordedKeys: () => string[]; reset: () => void } {
  const recorded: string[] = [];
  const files = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "get") {
          return async (key: string) => {
            recorded.push(key);
            throw new Error(`cross-org-file-bytes-probe: FILES.get(${key}) called — a wrong-org request reached the store`);
          };
        }
        return () => {
          throw new Error(`cross-org-file-bytes-probe: FILES.${String(prop)} accessed — unexpected store call`);
        };
      },
    },
  ) as unknown as R2Bucket;
  return {
    files,
    recordedKeys: () => [...recorded],
    reset: () => {
      recorded.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Actors — always org B, whichever role legitimately reaches the route.
// ---------------------------------------------------------------------------

const ORGANIZER_B: AuthInfo = { userId: "probe-organizer-b", role: "organizer", orgId: ORG_B, viaBearer: true };
const SPEAKER_B: AuthInfo = {
  userId: "probe-speaker-b",
  role: "speaker",
  orgId: ORG_B,
  contactId: CONTACT_B,
  viaBearer: true,
};

async function buildApp(db: Db, auth: AuthInfo, files: R2Bucket): Promise<Hono<AppEnv>> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    c.env = { ...(c.env ?? {}), FILES: files } as never;
    await next();
  });
  registerErrorHandler(app);
  const mounts = await parseIndexMounts();
  for (const { prefix, subApp } of mounts) {
    app.route(prefix, subApp);
  }
  return app;
}

// ---------------------------------------------------------------------------
// Population — derived from enumerateRegisteredRoutes() + a source-text scan
// for `store.get(` inside each candidate route's own handler body, never
// hand-listed. See header comment.
// ---------------------------------------------------------------------------

const BYTE_ROUTE_FILE_SUFFIXES = [
  "src/routes/files.ts",
  "src/routes/portal/tasks.tsx",
  "src/routes/portal/tasks/resources.tsx",
  "src/routes/portal/profile.tsx",
];

function deriveByteRoutePopulation(): RegisteredRoute[] {
  const all = enumerateRegisteredRoutes();
  const candidates = all.filter((r) => BYTE_ROUTE_FILE_SUFFIXES.some((suf) => r.file.endsWith(suf)));

  const byFile = new Map<string, RegisteredRoute[]>();
  for (const r of candidates) {
    const list = byFile.get(r.file) ?? [];
    list.push(r);
    byFile.set(r.file, list);
  }

  const out: RegisteredRoute[] = [];
  for (const [file, routes] of byFile) {
    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");
    const sorted = [...routes].sort((a, b) => a.line - b.line);
    for (let i = 0; i < sorted.length; i++) {
      const route = sorted[i]!;
      const startLine = route.line;
      const endLine = i + 1 < sorted.length ? sorted[i + 1]!.line : lines.length + 1;
      const body = lines.slice(startLine - 1, endLine - 1).join("\n");
      if (body.includes("store.get(")) out.push(route);
    }
  }
  out.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  return out;
}

// ---------------------------------------------------------------------------
// Ledger — one entry per derived byte-streaming route, asserted exact in
// both directions against deriveByteRoutePopulation() (test 1).
// ---------------------------------------------------------------------------

interface LedgerEntry {
  method: string;
  path: string;
  actor: AuthInfo;
  params: Record<string, string>;
  expectedStatus: 403 | 404;
  reason: string;
}

const LEDGER: LedgerEntry[] = [
  {
    method: "GET",
    path: "/files/:fileId",
    actor: ORGANIZER_B,
    params: { fileId: FILE_SUB_A },
    expectedStatus: 403,
    reason:
      "authzServeFile -> getFileScope -> getSubmissionScope resolves the file's real org; canAccessFile's organizer branch requires auth.orgId === scope.orgId -- refuses before makeFileStore(...).get is ever called.",
  },
  {
    method: "POST",
    path: "/api/v1/events/:eventId/files/archive",
    actor: ORGANIZER_B,
    params: { eventId: EVENT_A },
    expectedStatus: 404,
    reason:
      "getEventFilesScope loads the event's real org and the handler compares it to auth.orgId before parsing fileIds or making the first store.get call, refusing not_found per DEC-005 (existence-hiding, never 403).",
  },
  {
    method: "GET",
    path: "/portal/tasks/:assignmentId/file",
    actor: SPEAKER_B,
    params: { assignmentId: ASSIGNMENT_A },
    expectedStatus: 404,
    reason:
      "getAssignmentScope resolves the assignment's real org; scope.orgId !== auth.orgId throws not_found before resolveTaskFileChainLatest/store.get run.",
  },
  {
    method: "GET",
    path: "/portal/tasks/:assignmentId/file/:fileId",
    actor: SPEAKER_B,
    params: { assignmentId: ASSIGNMENT_A, fileId: FILE_TASK_A_V1 },
    expectedStatus: 404,
    reason: "Same getAssignmentScope org check as the GET .../file route above -- runs before the chain/store lookup.",
  },
  {
    method: "GET",
    path: "/portal/resources/:resourceId/download",
    actor: SPEAKER_B,
    params: { resourceId: RESOURCE_A },
    expectedStatus: 404,
    reason:
      "getResourceDownloadScope compares the resource's real event org to auth.orgId and returns null before getMyEventIds/store.get ever run.",
  },
  {
    method: "GET",
    path: "/headshots/:fileId",
    actor: ORGANIZER_B,
    params: { fileId: FILE_HEADSHOT_A },
    expectedStatus: 404,
    reason:
      "getHeadshotServeScope resolves the real owning contact's org; the fixture headshot is not publicly visible (its only submission is 'pending'), so a wrong-org organizer fails the private-branch check and 404s before store.get.",
  },
];

function ledgerKey(e: { method: string; path: string }): string {
  return `${e.method} ${e.path}`;
}

function toRequestPath(path: string, params: Record<string, string>): string {
  return path
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const name = segment.slice(1);
      const value = params[name];
      if (value === undefined) {
        throw new Error(`toRequestPath: no fixture value provided for :${name} in ${path}`);
      }
      return value;
    })
    .join("/");
}

// ---------------------------------------------------------------------------
// Org-A row snapshot — "byte-identical before/after" (DEC-459).
// ---------------------------------------------------------------------------

function snapshotOrgA(sqlite: DatabaseSync): string {
  const tables = ["event", "submission", "participant", "task", "task_assignment", "resource", "file", "contact"];
  const dump: Record<string, unknown[]> = {};
  for (const table of tables) {
    dump[table] = sqlite.prepare(`select * from ${table} order by id`).all() as unknown[];
  }
  return JSON.stringify(dump);
}

describe("cross-org file-bytes probe (DEC-459/DEC-550, task w37-d)", () => {
  it("population sanity: the derived byte-route set matches the ledger exactly, in both directions", () => {
    const derived = deriveByteRoutePopulation();
    const derivedKeys = new Set(derived.map(ledgerKey));
    const ledgerKeys = new Set(LEDGER.map(ledgerKey));

    const unledgered = [...derivedKeys].filter((k) => !ledgerKeys.has(k));
    const stale = [...ledgerKeys].filter((k) => !derivedKeys.has(k));

    expect(unledgered).toEqual([]); // a new byte route shipped unprobed
    expect(stale).toEqual([]); // a ledgered route no longer exists / no longer streams bytes
    expect(derived.length).toBeGreaterThanOrEqual(LEDGER.length); // enumeration floor
  });

  describe("wrong-org sweep", () => {
    let db: Db;
    let sqlite: DatabaseSync;
    let files: R2Bucket;
    let recordedKeys: () => string[];
    let resetFiles: () => void;

    beforeEach(() => {
      ({ db, sqlite } = makeSqliteDb());
      seedFixtures(sqlite);
      ({ files, recordedKeys, reset: resetFiles } = makeRecordingFiles());
    });

    afterEach(() => {
      sqlite.close();
    });

    it("every ledgered byte route refuses the wrong-org request at its exact status, body never carries file bytes, and the store is never asked for an org-A key", async () => {
      const before = snapshotOrgA(sqlite);
      const failures: string[] = [];

      for (const entry of LEDGER) {
        resetFiles();
        const app = await buildApp(db, entry.actor, files);
        const requestPath = toRequestPath(entry.path, entry.params);
        const headers: Record<string, string> = {};
        if (entry.method !== "GET" && entry.method !== "HEAD") {
          headers["content-type"] = "application/json";
        }

        const res = await app.request(requestPath, { method: entry.method, headers }, {} as unknown as AppEnv["Bindings"]);
        const bodyText = await res.text();

        if (res.status !== entry.expectedStatus) {
          failures.push(
            `${entry.method} ${entry.path} (requested ${requestPath}): status=${res.status}, expected ${entry.expectedStatus} -- ${
              res.status >= 200 && res.status < 300
                ? "a 2xx on a foreign-org id is a cross-org leak"
                : res.status >= 500
                  ? "a 5xx means the FILES stub was reached: the ownership check did not run first (DEC-550 leak)"
                  : "refusal status drifted from the ledgered contract"
            }`,
          );
        }
        if (res.status < 200 || res.status >= 600) {
          failures.push(`${entry.method} ${entry.path}: invalid HTTP status ${res.status}`);
        }

        // No response body may ever carry the fixture's stored bytes/keys.
        for (const key of ORG_A_KEYS) {
          if (bodyText.includes(key)) {
            failures.push(`${entry.method} ${entry.path}: response body leaked an org-A storage key (${key})`);
          }
        }

        // DEC-550: the object store must never even be asked for this
        // route's org-A key.
        const touchedOrgAKeys = recordedKeys().filter((k) => ORG_A_KEYS.has(k));
        if (touchedOrgAKeys.length > 0) {
          failures.push(
            `${entry.method} ${entry.path}: FILES.get was called with org-A key(s) ${touchedOrgAKeys.join(", ")} -- the store was asked for a foreign key before authz refused`,
          );
        }
      }

      expect(failures).toEqual([]);

      // Every recorded key across the WHOLE sweep must be zero org-A keys
      // (the second, cumulative DEC-550 signal).
      expect(recordedKeys().filter((k) => ORG_A_KEYS.has(k))).toEqual([]);

      // Org-A rows are byte-identical before/after the whole sweep -- no
      // refusal path silently mutated a foreign-owned row.
      const after = snapshotOrgA(sqlite);
      expect(after).toEqual(before);
    });
  });
});
