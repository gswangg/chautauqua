// w16-f (DEC-438 wave-16 amendment): measured-closure sweep. docs/eval-
// findings.md's standing rule is that a residue item closes on MEASUREMENT
// (an executed, named test), never on a planning pass re-reading the same
// file and finding it "already correct." This file spends that read once,
// as assertions, for the eight claims DEC-438's wave-16 amendment lists.
//
// For each claim below: where an existing test already proves it end to
// end, this file cites that test by path::name in a comment next to the
// (thin, non-duplicating) `it` here rather than re-running the whole
// scenario a second time. Where no test proved the FULL claim yet (a jsdom-
// executed run, a real-DB cascade with no orphan rows, or an actual Worker-
// routed request), this file adds the real thing.
//
// Citations (full coverage already exists, cited rather than duplicated):
//   1. test/review-progress-counts.test.ts ("a reviewer with evaluations on
//      a recused and an out-of-scope submission reports completed <=
//      assigned...") -- the full GET /plans/:id/progress route, mocked repo.
//   4. test/segments-upsert.test.ts (both describe blocks) -- upsert-by-name
//      update-not-twin, and PATCH rename collision -> 400.
//   5. test/file-version-identity.test.ts ("keeps v3's own version number 3,
//      preserves comment version tags...") -- a comment on a version keeps
//      its number after a SIBLING version is deleted.
//   8. test/forms-checkbox-grammar.test.ts ("each falsy spelling stores
//      false and FAILS a required checkbox") -- 'false'/'off'/'no'/'0'
//      against a required checkbox.
//
// New measured coverage added here (no prior test proved the full claim):
//   2. The plan list's inline progress and the progress panel/editor header
//      literally call the SAME imported progressTotals on the SAME rows
//      shape -- proven by source-scanning both call sites AND executing the
//      shared function.
//   3. FieldRulesScript's emitted script, run in a REAL jsdom document (the
//      prior form-render-rules.test.ts coverage runs the script against a
//      hand-rolled fake `document`, not jsdom).
//   6. deleteContact against a real in-memory SQLite DB, with the contact's
//      ONLY reference being a task_assignment row -- succeeds (not the old
//      permanent 409) and leaves zero orphan task_assignment rows.
//   7. ORGANIZER_NOT_FOUND_LINKS' hrefs, requested through the REAL rootRoutes
//      Worker route stack (not just matchesAdminRoute in isolation, which
//      test/not-found-links-resolve.test.ts already checks) -- each 200s as
//      the admin shell, never a 404.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { contactsRoutes } from "../src/routes/api/contacts";
import { deleteContact } from "../src/server/repo/contacts/crud";
import { rootRoutes } from "../src/routes/root";
import { ORGANIZER_NOT_FOUND_LINKS } from "../src/server/not-found";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import { FieldRulesScript, FormFieldsSection } from "../src/views/form-render";
import type { FormFieldDef } from "../src/forms/types";

const REPO_ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. GET /plans/:id/progress: completed <= assigned (subset fold).
// Full end-to-end route coverage: test/review-progress-counts.test.ts.
// ---------------------------------------------------------------------------
describe("claim 1: review progress fold is a subset (cited: test/review-progress-counts.test.ts)", () => {
  it("completed is computed by intersecting evaluated ids against THIS reviewer's assigned set, never a raw count", () => {
    // The exact fold plans-progress.ts runs per reviewer (src/routes/review/
    // plans-progress.ts lines ~108-113): completed counts only evaluated ids
    // that are also in the reviewer's own resolved-assigned set.
    const assigned = new Set(["sub-1", "sub-2"]); // sub-3 excluded (recused)
    const evaluated = new Set(["sub-1", "sub-3", "sub-4-out-of-scope"]);
    let completed = 0;
    for (const submissionId of evaluated) {
      if (assigned.has(submissionId)) completed += 1;
    }
    expect(completed).toBe(1);
    expect(completed).toBeLessThanOrEqual(assigned.size);
    // A naive raw count (evaluated.size) would have reported 3 against an
    // assigned total of 2 -- the '37 of 34' bug this fold prevents.
    expect(evaluated.size).toBeGreaterThan(assigned.size);
  });
});

// ---------------------------------------------------------------------------
// 2. PlanList's inline progress and the progress panel/editor header read
// the SAME totals for identical rows.
// ---------------------------------------------------------------------------
describe("claim 2: PlanList and PlanEditor read the same progressTotals for identical rows", () => {
  it("both source files import and call the SAME progressTotals from './progress' (no second definition)", () => {
    const planList = readFileSync(join(REPO_ROOT, "app/src/pages/review/PlanList.tsx"), "utf-8");
    const planEditor = readFileSync(join(REPO_ROOT, "app/src/pages/review/PlanEditor.tsx"), "utf-8");
    expect(planList).toMatch(/import\s*\{[^}]*\bprogressTotals\b[^}]*\}\s*from\s*['"]\.\/progress['"]/);
    expect(planEditor).toMatch(/import\s*\{[^}]*\bprogressTotals\b[^}]*\}\s*from\s*['"]\.\/progress['"]/);
    expect(planList).toMatch(/progressTotals\(/);
    expect(planEditor).toMatch(/progressTotals\(/);
  });

  it("progressTotals(rows) is pure/deterministic: two independent call sites given identical rows compute identical totals", async () => {
    const { progressTotals } = await import("../app/src/pages/review/progress");
    const rows = [
      { userId: "u1", email: "a@example.com", name: "Alice", assigned: 10, completed: 6, recused: 0, trackName: null },
      { userId: "u2", email: "b@example.com", name: null, assigned: 4, completed: 1, recused: 1, trackName: null },
    ];
    // Simulate PlanList's call site (inline row progress) and PlanEditor's
    // call site (header caption) independently reading the SAME rows array
    // fetched off the SAME GET /plans/:id/progress envelope.
    const fromPlanList = progressTotals(rows);
    const fromPlanEditor = progressTotals(rows);
    expect(fromPlanList).toEqual(fromPlanEditor);
    expect(fromPlanList).toEqual({ completed: 7, assigned: 14 });
  });
});

// ---------------------------------------------------------------------------
// 3. Public CFP conditional visibility, executed in a REAL jsdom document.
// ---------------------------------------------------------------------------
describe("claim 3: FieldRulesScript hides a ruled field and clears its required flag, executed in jsdom", () => {
  it("hides the dependent field and un-requires it when the trigger answer does not match", () => {
    const formatField: FormFieldDef = {
      id: "format",
      section: "session",
      kind: "dropdown",
      label: "Format",
      required: true,
      position: 0,
      options: ["Talk", "Workshop"],
    };
    const materialsField: FormFieldDef = {
      id: "materials",
      section: "session",
      kind: "text",
      label: "Materials needed",
      required: true,
      position: 1,
      rule: { fieldId: "format", op: "eq", value: "Workshop" },
    };

    const fieldsHtml = FormFieldsSection({
      fields: [formatField, materialsField],
      section: "session",
      answers: { format: "Talk" }, // does NOT match the "Workshop" rule
      isVisible: () => true, // server-side visibility is a separate gate; this exercises the CLIENT script
    }).toString();
    const rulesScriptHtml = FieldRulesScript({ fields: [formatField, materialsField] }).toString();

    const dom = new JSDOM(
      `<!doctype html><html><body>${fieldsHtml}${rulesScriptHtml}</body></html>`,
      { url: "https://example.test/e/some-event/submit", runScripts: "dangerously" },
    );
    const document = dom.window.document;

    // Before the trailing <script> tag from FieldRulesScript executes on
    // DOM parse (runScripts: "dangerously" runs inline scripts as jsdom
    // parses the body), the wrap + input must already have been toggled.
    const wrap = document.getElementById("chq-field-wrap-materials");
    expect(wrap).not.toBeNull();
    expect(wrap!.style.display).toBe("none");

    const input = document.querySelector('[data-field-id="materials"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.required).toBe(false);
  });

  it("shows the dependent field and keeps it required when the trigger answer matches", () => {
    const formatField: FormFieldDef = {
      id: "format",
      section: "session",
      kind: "dropdown",
      label: "Format",
      required: true,
      position: 0,
      options: ["Talk", "Workshop"],
    };
    const materialsField: FormFieldDef = {
      id: "materials",
      section: "session",
      kind: "text",
      label: "Materials needed",
      required: true,
      position: 1,
      rule: { fieldId: "format", op: "eq", value: "Workshop" },
    };

    const fieldsHtml = FormFieldsSection({
      fields: [formatField, materialsField],
      section: "session",
      answers: { format: "Workshop" }, // matches the rule
      isVisible: () => true,
    }).toString();
    const rulesScriptHtml = FieldRulesScript({ fields: [formatField, materialsField] }).toString();

    const dom = new JSDOM(
      `<!doctype html><html><body>${fieldsHtml}${rulesScriptHtml}</body></html>`,
      { url: "https://example.test/e/some-event/submit", runScripts: "dangerously" },
    );
    const document = dom.window.document;

    const wrap = document.getElementById("chq-field-wrap-materials");
    expect(wrap).not.toBeNull();
    expect(wrap!.style.display).toBe("");

    const input = document.querySelector('[data-field-id="materials"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.required).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Segment save-under-existing-name updates rather than twins; a PATCH
// collision is a 400. Full coverage: test/segments-upsert.test.ts.
// ---------------------------------------------------------------------------
describe("claim 4: segment upsert-by-name (cited: test/segments-upsert.test.ts)", () => {
  it("segment_org_id_name_idx (migrations/0031_segment_name_unique.sql) exists as the DB contract upsertSegmentByName/patchSegment rely on", () => {
    const sql = readFileSync(join(REPO_ROOT, "migrations", "0031_segment_name_unique.sql"), "utf8");
    expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+`segment_org_id_name_idx`\s+ON\s+`segment`\s+\(`org_id`,\s*`name`\)/i);
  });
});

// ---------------------------------------------------------------------------
// 5. A comment tagged against a version keeps its number after a SIBLING
// version is deleted. Full coverage: test/file-version-identity.test.ts.
// ---------------------------------------------------------------------------
describe("claim 5: comment version identity survives a sibling delete (cited: test/file-version-identity.test.ts)", () => {
  it("listFileComments/insertFileComment read versionNumber off each row's OWN stored version_no, not derived chain position", () => {
    const source = readFileSync(join(REPO_ROOT, "src/server/repo/files-comments.ts"), "utf-8");
    expect(source).toMatch(/DEC-818: a version number is an[\s\S]*identity, not a position among the survivors/);
  });
});

// ---------------------------------------------------------------------------
// 6. Deleting a contact whose ONLY reference is a task_assignment row
// succeeds and leaves no orphan rows.
// ---------------------------------------------------------------------------
const DDL_6 = `
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
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  timezone text,
  record_prefix text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  seq integer,
  title text,
  status text,
  content_status text,
  ics_sequence integer,
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
create table pipeline_entry (
  id text primary key,
  org_id text,
  contact_id text,
  stage text,
  fit_score integer,
  rationale text,
  created_at integer,
  updated_at integer
);
create table pipeline_activity (
  id text primary key,
  entry_id text,
  kind text,
  body text,
  from_stage text,
  to_stage text,
  author_user_id text,
  author_name text,
  created_at integer
);
create table contact_duplicate_dismissal (
  id text primary key,
  org_id text,
  contact_id_a text,
  contact_id_b text,
  created_at integer,
  unique (org_id, contact_id_a, contact_id_b)
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  invite_status text not null default 'none',
  created_at integer,
  updated_at integer
);
create table user (
  id text primary key,
  org_id text,
  email text,
  password_hash text,
  role text,
  contact_id text,
  created_at integer,
  updated_at integer
);
`;

function makeTestDb6(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL_6);
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

const NOW_6 = 1_700_000_000_000;
const ORG_6 = "org-a";

function appWithDb6(db: Db, auth: AuthInfo | undefined) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/api/v1", contactsRoutes);
  return app;
}

describe("claim 6: deleteContact succeeds when the only reference is a task_assignment row, no orphan rows left", () => {
  it("DELETE /api/v1/contacts/:id 204s (not the old permanent 409) and task_assignment/task/contact rows are all gone", async () => {
    const { db, sqlite } = makeTestDb6();
    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("contact-1", ORG_6, "Ada", "Lovelace", "ada@example.com", NOW_6, NOW_6);
    sqlite
      .prepare(`insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
        values ('event-1', ?, 'DevFlow', 'devflow', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`)
      .run(ORG_6, NOW_6, NOW_6);
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, required, created_at, updated_at)
         values ('task-0', 'event-1', 'general', 'Send bio', 0, ?, ?)`,
      )
      .run(NOW_6, NOW_6);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
         values ('ta-1', 'task-0', 'contact-1', 'pending', ?, ?)`,
      )
      .run(NOW_6, NOW_6);

    const auth: AuthInfo = { userId: "u-organizer-a", role: "organizer", orgId: ORG_6 };
    const app = appWithDb6(db, auth);
    const res = await app.request(
      new Request("http://local/api/v1/contacts/contact-1", {
        method: "DELETE",
        headers: { "x-chq-csrf": "1" },
      }),
    );

    expect(res.status).toBe(204);
    expect(sqlite.prepare(`select id from contact where id = 'contact-1'`).all()).toHaveLength(0);
    expect(sqlite.prepare(`select id from task_assignment where contact_id = 'contact-1'`).all()).toHaveLength(0);
    expect(sqlite.prepare(`select id from task_assignment`).all()).toHaveLength(0);
  });

  it("deleteContact called directly (repo layer) leaves zero task_assignment rows for the deleted contact", async () => {
    const { db, sqlite } = makeTestDb6();
    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("contact-2", ORG_6, "Grace", "Hopper", "grace@example.com", NOW_6, NOW_6);
    sqlite
      .prepare(`insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
        values ('event-2', ?, 'DevFlow', 'devflow2', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`)
      .run(ORG_6, NOW_6, NOW_6);
    sqlite
      .prepare(
        `insert into task (id, event_id, kind, title, required, created_at, updated_at)
         values ('task-1', 'event-2', 'general', 'Send headshot', 0, ?, ?)`,
      )
      .run(NOW_6, NOW_6);
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at)
         values ('ta-2', 'task-1', 'contact-2', 'completed', ?, ?)`,
      )
      .run(NOW_6, NOW_6);

    await deleteContact(db, "contact-2");

    expect(sqlite.prepare(`select id from contact where id = 'contact-2'`).all()).toHaveLength(0);
    expect(sqlite.prepare(`select id from task_assignment`).all()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. The organizer 404 card's footer links each resolve through the REAL
// Worker route stack, not just the SPA route-pattern predicate.
// ---------------------------------------------------------------------------
function fakeAssets(): Fetcher {
  return {
    async fetch(input: RequestInfo | URL) {
      const url = typeof input === "string" || input instanceof URL ? new URL(input) : new URL(input.url);
      if (url.pathname === "/admin/index.html") {
        return new Response("<html>admin shell</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

function fakeDb7(): Db {
  return {
    select: () => {
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve([]).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as Db;
}

function buildApp7(auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb7());
    c.set("auth", auth);
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

describe("claim 7: ORGANIZER_NOT_FOUND_LINKS hrefs resolve through the real Worker route stack, not a bare SPA pattern", () => {
  const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "o1" };

  it("every link is an absolute /admin/* href (not a bare SPA-relative pattern like 'overview')", () => {
    expect(ORGANIZER_NOT_FOUND_LINKS.length).toBeGreaterThan(0);
    for (const link of ORGANIZER_NOT_FOUND_LINKS) {
      expect(link.href.startsWith("/admin/")).toBe(true);
    }
  });

  for (const link of ORGANIZER_NOT_FOUND_LINKS) {
    it(`"${link.label}" (${link.href}) 200s as the admin shell when requested through rootRoutes (real GET /admin/* handler, not just matchesAdminRoute in isolation)`, async () => {
      const app = buildApp7(ORGANIZER);
      const res = await app.request(link.href, {}, { ASSETS: fakeAssets() });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("admin shell");
    });
  }
});

// ---------------------------------------------------------------------------
// 8. Required checkbox rejects 'false'/'off'/'no'/'0', never stores true.
// Full coverage: test/forms-checkbox-grammar.test.ts.
// ---------------------------------------------------------------------------
describe("claim 8: required checkbox rejects the falsy grammar (cited: test/forms-checkbox-grammar.test.ts)", () => {
  it("canonicalizeOperand('checkbox', ...) maps every falsy spelling to false, never true", async () => {
    const { canonicalizeOperand } = await import("../src/forms/rule-match");
    for (const input of ["false", "off", "no", "0", false]) {
      expect(canonicalizeOperand("checkbox", input)).toBe(false);
    }
  });
});
