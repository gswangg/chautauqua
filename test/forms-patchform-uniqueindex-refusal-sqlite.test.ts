// DEC-909 (wave-26 amendment): patchForm (src/server/repo/forms.ts) writes
// form.title with no unique-violation translation although
// form_event_id_title_idx (migrations/0033) is a real UNIQUE(event_id,
// title). Renaming the CFP form onto an existing form-task form's title
// (e.g. src/domain/acceptance.ts's "Hotel stay requirement form") via
// app/src/pages/settings/CallForPapersPanel.tsx -> src/routes/api/forms.ts
// 500s. The sibling case is already handled in
// src/server/repo/tasks/crud.ts's updateTask ("task.title" ->
// ApiError("invalid", ...)). This pins the WRITE half against a real
// (in-memory) SQLite engine (same DDL technique as
// test/form-title-unique.test.ts) with form_event_id_title_idx present, so
// the real constraint -- not a fake store without one -- is what's
// exercised.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { patchForm } from "../src/server/repo/forms";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";

const DDL = `
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
create unique index form_event_id_title_idx on form (event_id, title);
`;

const T0 = 1_700_000_000_000;
const EVENT_ID = "event-1";

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
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

function seedForm(sqlite: DatabaseSync, id: string, title: string): void {
  sqlite
    .prepare(`insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, ?, 0, ?, ?)`)
    .run(id, EVENT_ID, title, T0, T0);
}

describe("DEC-909 (wave-26 amendment): patchForm honors form_event_id_title_idx", () => {
  it("renaming a form onto an existing form's title in the same event throws the named refusal, never a raw DrizzleQueryError", async () => {
    const { db, sqlite } = makeTestDb();
    seedForm(sqlite, "form-cfp", "Call for papers");
    seedForm(sqlite, "form-hotel-task", "Hotel stay requirement form");

    await expect(patchForm(db, "form-cfp", { title: "Hotel stay requirement form" })).rejects.toMatchObject({
      code: "invalid",
      message: "A form with this title already exists for this event",
      fields: { title: "Already in use" },
    });

    let caught: unknown;
    try {
      await patchForm(db, "form-cfp", { title: "Hotel stay requirement form" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);

    // The CFP form's title was not partially applied by the failed write.
    const row = sqlite.prepare(`select title from form where id = 'form-cfp'`).get() as { title: string };
    expect(row.title).toBe("Call for papers");
  });

  it("renaming a form onto an unused title in the same event succeeds", async () => {
    const { db, sqlite } = makeTestDb();
    seedForm(sqlite, "form-cfp", "Call for papers");

    const updated = await patchForm(db, "form-cfp", { title: "2027 Call for papers" });
    expect(updated.title).toBe("2027 Call for papers");
  });

  it("renaming a form onto a same-titled form in a DIFFERENT event succeeds -- the index is scoped per event", async () => {
    const { db, sqlite } = makeTestDb();
    seedForm(sqlite, "form-cfp", "Call for papers");
    sqlite
      .prepare(`insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, ?, 0, ?, ?)`)
      .run("form-other-event", "event-2", "Hotel stay requirement form", T0, T0);

    const updated = await patchForm(db, "form-cfp", { title: "Hotel stay requirement form" });
    expect(updated.title).toBe("Hotel stay requirement form");
  });
});
