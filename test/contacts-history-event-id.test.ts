// DEC-795: the per-contact submission history the CRM "Add to event" modal
// reads from must carry the event's own id alongside its display name -- a
// name is not an identity, and the modal needs to test "is THIS the
// selected event" without string-matching eventName. Runs the real
// getContactHistory against a real (in-memory) SQLite engine via
// node:sqlite + drizzle-orm's sqlite-proxy driver (same technique as
// test/onboarding-roster-set.test.ts), so the actual innerJoin projection
// is exercised, not a hand-simulated row shape.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { getContactHistory, MAX_CONTACT_HISTORY_EVENTS } from "../src/server/repo/contacts/history";
import { newId } from "../src/domain/ids";
import type { Db } from "../src/server/context";

const DDL = `
create table contact (
  id text primary key,
  org_id text,
  first_name text,
  last_name text,
  email text,
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
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  created_at integer,
  updated_at integer
);
create table email_log (
  id text primary key,
  event_id text,
  contact_id text,
  to_email text,
  subject text,
  body_text text,
  status text,
  sent_at integer,
  created_at integer,
  updated_at integer
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

const NOW = 1_700_000_000_000;

describe("getContactHistory carries eventId alongside eventName (DEC-795)", () => {
  it("returns the owning event's id for each submission row", () => {
    const { db, sqlite } = makeTestDb();

    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', 'Priya', 'Raman', 'priya@example.com', ?, ?)`,
      )
      .run("contact-1", NOW, NOW);

    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values (?, 'org-1', ?, ?, '2027-01-01', '2027-01-02', 'UTC', 'SUB', ?, ?)`,
      )
      .run("event-1", "DevFlow Conf 2027", "devflow-2027", NOW, NOW);
    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values (?, 'org-1', ?, ?, '2028-01-01', '2028-01-02', 'UTC', 'SUB', ?, ?)`,
      )
      .run("event-2", "Forward Summit 2028", "forward-2028", NOW, NOW);

    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values (?, ?, 1, 'Keynote', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run("sub-1", "event-1", NOW, NOW);
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values (?, ?, 1, 'Panel', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run("sub-2", "event-2", NOW + 1, NOW + 1);

    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
         values (?, ?, 'contact-1', 'speaker', 0, 1, ?, ?)`,
      )
      .run(newId(), "sub-1", NOW, NOW);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
         values (?, ?, 'contact-1', 'speaker', 0, 1, ?, ?)`,
      )
      .run(newId(), "sub-2", NOW + 1, NOW + 1);

    return getContactHistory(db, "contact-1").then((history) => {
      expect(history.submissions).toHaveLength(2);
      expect(history.submissions.map((s) => ({ eventId: s.eventId, eventName: s.eventName }))).toEqual([
        { eventId: "event-1", eventName: "DevFlow Conf 2027" },
        { eventId: "event-2", eventName: "Forward Summit 2028" },
      ]);
      // eventName alone is a display value -- eventId is the identity a
      // consumer must test "is this THE selected event" against.
      for (const s of history.submissions) {
        expect(typeof s.eventId).toBe("string");
        expect(s.eventId.length).toBeGreaterThan(0);
      }
      // A contact with no more submissions than the cap has nothing capped.
      expect(history.submissionsTotal).toBe(2);
    });
  });
});

// w56-c (DEC-026 wave-56 amendment): the submissions list is capped at
// MAX_CONTACT_HISTORY_SUBMISSIONS, but submissionsTotal and events are each
// their own query over the FULL join -- capping the list can never shrink
// the "Across your events" list or hide how many submissions exist.
describe("getContactHistory bounds submissions and reports the full total (w56-c)", () => {
  it("caps submissions at 20, reports submissionsTotal 25, and lists all 3 events", async () => {
    const { db, sqlite } = makeTestDb();

    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', 'Priya', 'Raman', 'priya@example.com', ?, ?)`,
      )
      .run("contact-1", NOW, NOW);

    const eventIds = ["event-a", "event-b", "event-c"];
    const eventNames = ["Alpha Conf", "Beta Summit", "Gamma Forum"];
    for (let i = 0; i < eventIds.length; i++) {
      sqlite
        .prepare(
          `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
           values (?, 'org-1', ?, ?, '2027-01-01', '2027-01-02', 'UTC', 'SUB', ?, ?)`,
        )
        .run(eventIds[i]!, eventNames[i]!, `slug-${i}`, NOW, NOW);
    }

    // 25 submissions spread across the 3 events, each with a distinct
    // createdAt so DEC-534's (createdAt asc, id asc) order is deterministic.
    for (let i = 0; i < 25; i++) {
      const subId = `sub-${i}`;
      const eventId = eventIds[i % eventIds.length]!;
      sqlite
        .prepare(
          `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
           values (?, ?, 1, ?, 'accepted', 'approved', 0, ?, ?)`,
        )
        .run(subId, eventId, `Talk ${i}`, NOW + i, NOW + i);
      sqlite
        .prepare(
          `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
           values (?, ?, 'contact-1', 'speaker', 0, 1, ?, ?)`,
        )
        .run(newId(), subId, NOW + i, NOW + i);
    }

    const history = await getContactHistory(db, "contact-1");
    expect(history.submissions).toHaveLength(20);
    expect(history.submissionsTotal).toBe(25);
    // deterministic (createdAt asc, id asc) order -- the first 20 of 25.
    expect(history.submissions.map((s) => s.title)).toEqual(
      Array.from({ length: 20 }, (_, i) => `Talk ${i}`),
    );
    expect(new Set(history.events)).toEqual(new Set(eventNames));
    expect(history.events).toHaveLength(3);
  });
});

// w52-f (DEC-026 amendment): the emails list is capped at
// MAX_CONTACT_HISTORY_EMAILS exactly as submissions is capped at
// MAX_CONTACT_HISTORY_SUBMISSIONS -- emailsTotal is its own count(*) over
// the same predicate as the row query, never emailRows.length, so capping
// the list can never shrink it or silently hide the true total.
describe("getContactHistory bounds emails and reports the full total (w52-f)", () => {
  it("caps emails at MAX_CONTACT_HISTORY_EMAILS, reports the true emailsTotal, and never shrinks events/submissionsTotal", async () => {
    const { db, sqlite } = makeTestDb();

    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', 'Priya', 'Raman', 'priya@example.com', ?, ?)`,
      )
      .run("contact-1", NOW, NOW);

    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values ('event-1', 'org-1', 'DevFlow Conf 2027', 'slug-e1', '2027-01-01', '2027-01-02', 'UTC', 'SUB', ?, ?)`,
      )
      .run(NOW, NOW);

    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values ('sub-1', 'event-1', 1, 'Scaling caches', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run(NOW, NOW);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
         values (?, 'sub-1', 'contact-1', 'speaker', 0, 1, ?, ?)`,
      )
      .run(newId(), NOW, NOW);

    // 30 emails logged for this contact -- more than the cap of 20.
    for (let i = 0; i < 30; i++) {
      sqlite
        .prepare(
          `insert into email_log (id, event_id, contact_id, to_email, subject, body_text, status, sent_at, created_at, updated_at)
           values (?, 'event-1', 'contact-1', 'priya@example.com', ?, 'body', 'sent', ?, ?, ?)`,
        )
        .run(`email-${i}`, `Subject ${i}`, NOW + i, NOW + i, NOW + i);
    }

    const history = await getContactHistory(db, "contact-1");
    expect(history.emails).toHaveLength(20);
    expect(history.emailsTotal).toBe(30);
    // capping the emails list must never shrink the OTHER collections.
    expect(history.submissionsTotal).toBe(1);
    expect(history.events).toEqual(["DevFlow Conf 2027"]);
  });

  it("reports emailsTotal equal to emails.length when at or below the cap", async () => {
    const { db, sqlite } = makeTestDb();

    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', 'Priya', 'Raman', 'priya@example.com', ?, ?)`,
      )
      .run("contact-1", NOW, NOW);

    for (let i = 0; i < 3; i++) {
      sqlite
        .prepare(
          `insert into email_log (id, event_id, contact_id, to_email, subject, body_text, status, sent_at, created_at, updated_at)
           values (?, null, 'contact-1', 'priya@example.com', ?, 'body', 'sent', ?, ?, ?)`,
        )
        .run(`email-${i}`, `Subject ${i}`, NOW + i, NOW + i, NOW + i);
    }

    const history = await getContactHistory(db, "contact-1");
    expect(history.emails).toHaveLength(3);
    expect(history.emailsTotal).toBe(3);
  });
});

// w47-f (closes CONFIRMED-DEFECT #4, docs/verification-log/index/0234): the
// "Across your events" distinct-events list is capped at
// MAX_CONTACT_HISTORY_EVENTS exactly as submissions/emails are capped --
// eventsTotal is its own count(distinct event.id) over the same predicate
// as the row query, never events.length, so capping the list can never
// hide the true total.
describe("getContactHistory bounds events and reports the full total (w47-f)", () => {
  it("caps events at MAX_CONTACT_HISTORY_EVENTS, reports the true eventsTotal, and never shrinks submissions/emails totals", async () => {
    const { db, sqlite } = makeTestDb();

    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', 'Priya', 'Raman', 'priya@example.com', ?, ?)`,
      )
      .run("contact-1", NOW, NOW);

    const totalEvents = MAX_CONTACT_HISTORY_EVENTS + 1;
    for (let i = 0; i < totalEvents; i++) {
      const eventId = `event-${i}`;
      // zero-pad so lexical (name asc) order matches insertion order for
      // deterministic slicing.
      const name = `Event ${String(i).padStart(3, "0")}`;
      sqlite
        .prepare(
          `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
           values (?, 'org-1', ?, ?, '2027-01-01', '2027-01-02', 'UTC', 'SUB', ?, ?)`,
        )
        .run(eventId, name, `slug-${i}`, NOW, NOW);

      const subId = `sub-${i}`;
      sqlite
        .prepare(
          `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
           values (?, ?, 1, ?, 'accepted', 'approved', 0, ?, ?)`,
        )
        .run(subId, eventId, `Talk ${i}`, NOW + i, NOW + i);
      sqlite
        .prepare(
          `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
           values (?, ?, 'contact-1', 'speaker', 0, 1, ?, ?)`,
        )
        .run(newId(), subId, NOW + i, NOW + i);
    }

    const history = await getContactHistory(db, "contact-1");
    // one distinct event per submission, one over the cap.
    expect(history.events).toHaveLength(MAX_CONTACT_HISTORY_EVENTS);
    expect(history.eventsTotal).toBe(totalEvents);
    // deterministic (event.name asc) order -- the first N of totalEvents.
    expect(history.events).toEqual(
      Array.from({ length: MAX_CONTACT_HISTORY_EVENTS }, (_, i) => `Event ${String(i).padStart(3, "0")}`),
    );
  });

  it("reports eventsTotal equal to events.length when at or below the cap", async () => {
    const { db, sqlite } = makeTestDb();

    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at) values (?, 'org-1', 'Priya', 'Raman', 'priya@example.com', ?, ?)`,
      )
      .run("contact-1", NOW, NOW);

    sqlite
      .prepare(
        `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
         values ('event-1', 'org-1', 'DevFlow Conf 2027', 'slug-e1', '2027-01-01', '2027-01-02', 'UTC', 'SUB', ?, ?)`,
      )
      .run(NOW, NOW);
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, content_status, ics_sequence, created_at, updated_at)
         values ('sub-1', 'event-1', 1, 'Keynote', 'accepted', 'approved', 0, ?, ?)`,
      )
      .run(NOW, NOW);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, created_at, updated_at)
         values (?, 'sub-1', 'contact-1', 'speaker', 0, 1, ?, ?)`,
      )
      .run(newId(), NOW, NOW);

    const history = await getContactHistory(db, "contact-1");
    expect(history.events).toEqual(["DevFlow Conf 2027"]);
    expect(history.eventsTotal).toBe(1);
  });
});
