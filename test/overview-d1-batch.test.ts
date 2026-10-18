// The overview's first wave goes to the database as one D1 batch. A D1
// batch returns each row as an object keyed by column name, and drizzle
// turns it back into a positional array (d1ToRawMapping) -- so two selected
// columns with the same name (a joined table's `id`, `due_date`) collapse
// and every value after them shifts. Local miniflare never showed it; prod
// threw "Invalid instant 'NaN'". This runs getOverviewPayload over the real
// migrated schema through a batch callback with D1's row shape, so a
// batched query with a duplicate column name fails here, not on prod.
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { getOverviewPayload } from "../src/server/repo/overview";
import { addContact, addEvent, addOrg, addParticipant, addSession, addTask, makePortalsFixture, type Fixture } from "./helpers/portals-fixture";

const ORG = "odb-org";
const EVENT = "odb-event";
const DAY = 24 * 60 * 60 * 1000;

/** The fixture's database, with a batch that answers the way D1 does:
 * each statement's rows as objects keyed by column name, mapped back to
 * arrays by key order. */
function d1LikeDb(f: Fixture): Db {
  const prepare = (sqlText: string) => f.sqlite.prepare(sqlText);
  return drizzle(
    async (sqlText, params, method) => {
      const stmt = prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...(params as (string | number | null)[]));
        return { rows: [] };
      }
      return { rows: stmt.all(...(params as (string | number | null)[])) as unknown[] };
    },
    async (queries) =>
      queries.map((q) => {
        const rows = prepare(q.sql).all(...(q.params as (string | number | null)[])) as Record<string, unknown>[];
        return { rows: rows.map((row) => Object.keys(row).map((k) => row[k])) };
      }),
    { schema },
  ) as unknown as Db;
}

describe("overview · first wave through a D1-shaped batch", () => {
  it("maps every batched row correctly, including the overdue rows that join two tables", async () => {
    const f = makePortalsFixture();
    const now = f.now;
    addOrg(f, ORG);
    addEvent(f, EVENT, ORG);
    addContact(f, "odb-ada", ORG, "Ada Lovelace");
    addSession(f, "odb-talk", EVENT, { title: "Engines" });
    addParticipant(f, "odb-part", "odb-talk", "odb-ada");
    addTask(f, "odb-slides", EVENT, { title: "Upload slides", dueDate: now - 3 * DAY });
    f.run(
      `insert into task_assignment (id, task_id, contact_id, status, created_at, updated_at) values ('odb-a1', 'odb-slides', 'odb-ada', 'pending', ?, ?)`,
      now - 30 * DAY,
      now - 30 * DAY,
    );

    const payload = await getOverviewPayload(d1LikeDb(f), EVENT, now, "UTC");

    expect(payload.overdueTasks.total).toBe(1);
    expect(payload.overdueTasks.rows).toHaveLength(1);
    const row = payload.overdueTasks.rows[0]!;
    expect(row).toMatchObject({ assignmentId: "odb-a1", contactId: "odb-ada", contactName: "Ada Lovelace", taskId: "odb-slides", taskTitle: "Upload slides" });
    expect(Number.isFinite(row.dueDate)).toBe(true);
    expect(row.daysLate).toBeGreaterThanOrEqual(3);
    expect(payload.agenda.unplaced).toBe(1);
    f.sqlite.close();
  });
});
