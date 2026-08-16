// DEC-891 (wave 66 amendment): a speaker's upload picker must offer only
// accepted-session candidates. listDeliverableCandidates and
// listDeliverableCandidatesForEvents previously scoped by
// participant/ACTIVE_INVITE_STATUSES only, with no submission.status filter
// -- so a declined submission on the same event as an accepted one produced
// TWO candidates, tripping resolveChosenDeliverable's spurious
// required-submissionId 400 for a speaker who in fact has exactly one
// eligible session. Runs the real repo functions against a real (in-memory)
// SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy driver (same
// technique as test/submission-touch-on-write.test.ts), so the actual WHERE
// clause is exercised, not hand-simulated.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import {
  listDeliverableCandidates,
  listDeliverableCandidatesForEvents,
  resolveChosenDeliverable,
} from "../src/server/repo/portal/tasks";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";

const DDL = `
create table event (
  id text primary key,
  org_id text,
  record_prefix text,
  start_date text,
  end_date text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  seq integer,
  title text,
  status text,
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
  invite_status text not null default 'none',
  created_at integer,
  updated_at integer,
  unique (submission_id, contact_id)
);
`;

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

const T0 = 1_700_000_000_000;
const CONTACT_A = "contact-a";
const EVENT_1 = "event-1";

function seed(sqlite: DatabaseSync) {
  sqlite.exec(`
    insert into event (id, org_id, record_prefix, created_at, updated_at)
      values ('${EVENT_1}', 'org-a', 'SES', ${T0}, ${T0});
    insert into submission (id, event_id, seq, title, status, created_at, updated_at)
      values ('sub-accepted', '${EVENT_1}', 1, 'Accepted Talk', 'accepted', ${T0}, ${T0});
    insert into submission (id, event_id, seq, title, status, created_at, updated_at)
      values ('sub-declined', '${EVENT_1}', 2, 'Declined Talk', 'declined', ${T0}, ${T0});
    insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
      values ('p1', 'sub-accepted', '${CONTACT_A}', 'speaker', 0, 1, 'accepted', ${T0}, ${T0});
    insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
      values ('p2', 'sub-declined', '${CONTACT_A}', 'speaker', 0, 1, 'accepted', ${T0}, ${T0});
  `);
}

describe("listDeliverableCandidates (DEC-891 wave 66 amendment: accepted-only)", () => {
  it("excludes a declined submission on the same event, leaving exactly one candidate", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite);

    const candidates = await listDeliverableCandidates(db, CONTACT_A, EVENT_1);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: "sub-accepted", status: "accepted" });
  });

  it("resolveChosenDeliverable resolves the single accepted candidate silently (no spurious 400)", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite);

    const candidates = await listDeliverableCandidates(db, CONTACT_A, EVENT_1);
    const resolved = resolveChosenDeliverable(candidates, null);

    expect(resolved).toBe("sub-accepted");
  });

  it("resolveChosenDeliverable refuses a posted submissionId naming the declined talk as forbidden", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite);

    const candidates = await listDeliverableCandidates(db, CONTACT_A, EVENT_1);

    expect(() => resolveChosenDeliverable(candidates, "sub-declined")).toThrow(ApiError);
    try {
      resolveChosenDeliverable(candidates, "sub-declined");
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("forbidden");
    }
  });
});

describe("listDeliverableCandidatesForEvents (DEC-891 wave 66 amendment: accepted-only)", () => {
  it("excludes a declined submission on the same event, leaving exactly one candidate", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite);

    const byEvent = await listDeliverableCandidatesForEvents(db, CONTACT_A, [EVENT_1]);
    const candidates = byEvent.get(EVENT_1) ?? [];

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: "sub-accepted", status: "accepted" });
  });
});
