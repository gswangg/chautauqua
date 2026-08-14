// DEC-319 wave-56 amendment: the reminder batch's recipient set is now
// chosen in SQL (listRemindableContactIds) instead of loaded whole and
// sliced in JS. Runs the real repo functions against a real in-memory
// SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy driver, same
// technique as test/contact-delete-refusal-rows.test.ts (no D1 test harness
// exists in stage 1) — so the GROUP BY/HAVING/ORDER BY/LIMIT is exercised
// for real, not a hand-simulated fake.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import {
  listOutstandingForEvent,
  listRemindableContactIds,
  previewRemindNow,
  remindNow,
} from "../src/server/repo/tasks/reminders";
import { MANUAL_DEDUPE_WINDOW_MS, MAX_REMINDER_BATCH } from "../src/domain/reminders";
import type { Db } from "../src/server/context";
import type { Mailer } from "../src/mail/types";
import type { KVStore } from "../src/auth/claim";

const DDL = `
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

class InMemoryKV implements KVStore {
  private readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function fakeMailer(): { mailer: Mailer; sendCalls: { to: { email: string } }[] } {
  const sendCalls: { to: { email: string } }[] = [];
  const mailer: Mailer = {
    async send(m) {
      sendCalls.push(m as { to: { email: string } });
    },
  };
  return { mailer, sendCalls };
}

const EVENT_ID = "event-1";
const ORG_ID = "org-1";
const ORIGIN = "https://events.example.com";
const NOW_MS = 1_700_000_000_000;
const NOW = new Date(NOW_MS);
const MINUTE = 60 * 1000;

function contactId(i: number): string {
  // zero-padded so lexicographic ("<") ordering matches numeric ordering
  return `contact-${String(i).padStart(4, "0")}`;
}

function seedManyContacts(sqlite: DatabaseSync, count: number, opts?: { remindedRecentlyId?: string }) {
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values (?, ?, 'DevFlow Conf', 'devflow', '2027-01-01', '2027-01-02', 'UTC', 'DFC', ?, ?)`,
    )
    .run(EVENT_ID, ORG_ID, NOW_MS, NOW_MS);
  sqlite
    .prepare(
      `insert into task (id, event_id, kind, title, description, due_date, required, created_at, updated_at)
       values ('task-1', ?, 'onboarding', 'Submit bio', null, null, 1, ?, ?)`,
    )
    .run(EVENT_ID, NOW_MS, NOW_MS);

  for (let i = 1; i <= count; i++) {
    const cId = contactId(i);
    sqlite
      .prepare(
        `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
         values (?, ?, 'First', ?, ?, ?, ?)`,
      )
      .run(cId, ORG_ID, cId, `${cId}@example.com`, NOW_MS, NOW_MS);

    const lastRemindedAt = opts?.remindedRecentlyId === cId ? NOW_MS - 10 * MINUTE : null;
    sqlite
      .prepare(
        `insert into task_assignment (id, task_id, contact_id, status, last_reminded_at, created_at, updated_at)
         values (?, 'task-1', ?, 'pending', ?, ?, ?)`,
      )
      .run(`assign-${cId}`, cId, lastRemindedAt, NOW_MS, NOW_MS);
  }
}

describe("listRemindableContactIds (DEC-319 wave-56 amendment)", () => {
  it("300 contacts: chooses first 100 ascending contactIds, remaining=200, and rows loaded belong only to the chosen contacts", async () => {
    const { db, sqlite } = makeTestDb();
    const remindedRecentlyId = contactId(150); // inside the 300, but reminded 10m ago
    seedManyContacts(sqlite, 300, { remindedRecentlyId });

    const chosen = await listRemindableContactIds(db, EVENT_ID, {
      now: NOW_MS,
      dedupeWindowMs: MANUAL_DEDUPE_WINDOW_MS,
      max: MAX_REMINDER_BATCH,
    });

    expect(chosen.contactIds).toHaveLength(MAX_REMINDER_BATCH);
    expect(chosen.contactIds).toEqual([...chosen.contactIds].sort());
    expect(chosen.contactIds[0]).toBe(contactId(1));
    expect(chosen.contactIds[chosen.contactIds.length - 1]).toBe(contactId(100));
    // 300 total - 1 skipped (reminded 10m ago) = 299 eligible; 100 chosen => 199 remaining
    expect(chosen.skipped).toBe(1);
    expect(chosen.remaining).toBe(199);

    const outstanding = await listOutstandingForEvent(db, EVENT_ID, undefined, chosen.contactIds);
    const loadedContactIds = new Set(outstanding.map((r) => r.contactId));
    expect(loadedContactIds.size).toBe(100);
    for (const id of loadedContactIds) {
      expect(chosen.contactIds).toContain(id);
    }
  });

  it("send and preview select the SAME first 100 contact ids by ascending contactId", async () => {
    const sendHarness = makeTestDb();
    const previewHarness = makeTestDb();
    seedManyContacts(sendHarness.sqlite, 300);
    seedManyContacts(previewHarness.sqlite, 300);
    const { mailer, sendCalls } = fakeMailer();

    const preview = await previewRemindNow(previewHarness.db, EVENT_ID, undefined, NOW, new InMemoryKV(), ORIGIN);
    const sendResult = await remindNow(sendHarness.db, mailer, EVENT_ID, undefined, NOW, new InMemoryKV(), ORIGIN);

    expect(sendResult.remaining).toBe(200);
    expect(preview.remaining).toBe(200);
    expect(sendResult.skipped).toBe(0);
    expect(preview.skipped).toBe(0);

    const previewIds = preview.drafts.map((d) => d.email.split("@")[0]).sort();
    const sentIds = sendCalls.map((c) => c.to.email.split("@")[0]).sort();
    expect(sentIds).toHaveLength(100);
    expect(previewIds).toEqual(sentIds);
  });
});
