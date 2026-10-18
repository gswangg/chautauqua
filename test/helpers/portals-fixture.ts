// Shared real-SQLite fixture for multi-portal tests: every migration
// applied to node:sqlite (the makeTestDb idiom of test/spec9-invariants),
// plus small row builders for events, people, sessions, portals and
// sponsors.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../../src/db/schema";
import type { Db } from "../../src/server/context";
import type { PortalRule } from "../../src/domain/portals/rules";
import type { Capabilities, FieldPermissions } from "../../src/domain/portals/permissions";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");

export interface Fixture {
  db: Db;
  sqlite: DatabaseSync;
  now: number;
  run: (sql: string, ...params: (string | number | null)[]) => void;
  all: <T = Record<string, unknown>>(sql: string, ...params: (string | number | null)[]) => T[];
}

export function makePortalsFixture(now = Date.UTC(2027, 2, 1, 12)): Fixture {
  const sqlite = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...(params as (string | number | null)[]));
        return { rows: [] };
      }
      return { rows: stmt.all(...(params as (string | number | null)[])) as unknown[] };
    },
    { schema },
  ) as unknown as Db;
  return {
    db,
    sqlite,
    now,
    run: (sql, ...params) => void sqlite.prepare(sql).run(...params),
    all: <T,>(sql: string, ...params: (string | number | null)[]) => sqlite.prepare(sql).all(...params) as T[],
  };
}

export function addOrg(f: Fixture, id: string): void {
  f.run(`insert into org (id, name, created_at, updated_at) values (?, ?, ?, ?)`, id, id, f.now, f.now);
}

export function addEvent(f: Fixture, id: string, orgId: string, opts: { timezone?: string } = {}): void {
  f.run(
    `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
     values (?, ?, ?, ?, '2027-05-12', '2027-05-14', ?, 'DFC', ?, ?)`,
    id,
    orgId,
    `Event ${id}`,
    `slug-${id}`,
    opts.timezone ?? "UTC",
    f.now,
    f.now,
  );
}

export function addContact(f: Fixture, id: string, orgId: string, name: string, opts: { custom?: Record<string, string> } = {}): void {
  const [first, ...rest] = name.split(" ");
  f.run(
    `insert into contact (id, org_id, first_name, last_name, email, custom_fields_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    orgId,
    first ?? name,
    rest.join(" "),
    `${id}@example.com`,
    opts.custom ? JSON.stringify(opts.custom) : null,
    f.now,
    f.now,
  );
}

let seq = 0;
export function addSession(
  f: Fixture,
  id: string,
  eventId: string,
  opts: { title?: string; status?: string; origin?: string } = {},
): void {
  seq += 1;
  f.run(
    `insert into submission (id, event_id, seq, title, status, origin, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    eventId,
    seq,
    opts.title ?? `Session ${id}`,
    opts.status ?? "accepted",
    opts.origin ?? "cfp",
    f.now,
    f.now,
  );
}

export function addParticipant(
  f: Fixture,
  id: string,
  submissionId: string,
  contactId: string,
  opts: { role?: string; inviteStatus?: string } = {},
): void {
  f.run(
    `insert into participant (id, submission_id, contact_id, role, invite_status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    id,
    submissionId,
    contactId,
    opts.role ?? "speaker",
    opts.inviteStatus ?? "none",
    f.now,
    f.now,
  );
}

export function addTask(
  f: Fixture,
  id: string,
  eventId: string,
  opts: { title?: string; kind?: string; scope?: "person" | "participation"; dueDate?: number | null } = {},
): void {
  f.run(
    `insert into task (id, event_id, kind, title, scope, due_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    eventId,
    opts.kind ?? "general",
    opts.title ?? `Task ${id}`,
    opts.scope ?? "person",
    opts.dueDate ?? null,
    f.now,
    f.now,
  );
}

export function addPortal(
  f: Fixture,
  id: string,
  eventId: string,
  rule: PortalRule,
  opts: {
    name?: string;
    note?: string | null;
    fields?: FieldPermissions;
    capabilities?: Capabilities;
    notifyOnJoin?: boolean;
    position?: number;
  } = {},
): void {
  f.run(
    `insert into portal (id, event_id, name, note, rule_json, field_permissions_json, capabilities_json, notify_on_join, position, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    eventId,
    opts.name ?? id,
    opts.note ?? null,
    JSON.stringify(rule),
    JSON.stringify(opts.fields ?? {}),
    JSON.stringify(opts.capabilities ?? {}),
    opts.notifyOnJoin === false ? 0 : 1,
    opts.position ?? 1,
    f.now,
    f.now,
  );
}

export function addPortalItem(
  f: Fixture,
  id: string,
  portalId: string,
  ref: { taskId?: string; resourceId?: string; systemKind?: string },
  opts: {
    deadlineKind?: "none" | "fixed" | "relative";
    dueDate?: number | null;
    relativeDays?: number | null;
    required?: boolean;
    graceDays?: number;
    displayName?: string | null;
  } = {},
): void {
  f.run(
    `insert into portal_item (id, portal_id, task_id, resource_id, system_kind, display_name, deadline_kind, due_date, relative_days, required, grace_days, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    portalId,
    ref.taskId ?? null,
    ref.resourceId ?? null,
    ref.systemKind ?? null,
    opts.displayName ?? null,
    opts.deadlineKind ?? "none",
    opts.dueDate ?? null,
    opts.relativeDays ?? null,
    opts.required ? 1 : 0,
    opts.graceDays ?? 0,
    f.now,
    f.now,
  );
}

export function addSponsor(
  f: Fixture,
  ids: { company: string; sponsorship: string; tier?: string | null },
  orgId: string,
  eventId: string,
  opts: { name?: string; status?: string } = {},
): void {
  f.run(`insert into sponsor_company (id, org_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)`, ids.company, orgId, opts.name ?? ids.company, f.now, f.now);
  f.run(
    `insert into sponsorship (id, event_id, company_id, tier_id, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)`,
    ids.sponsorship,
    eventId,
    ids.company,
    ids.tier ?? null,
    opts.status ?? "active",
    f.now,
    f.now,
  );
}

export function addTier(f: Fixture, id: string, eventId: string, name: string): void {
  f.run(`insert into sponsor_tier (id, event_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)`, id, eventId, name, f.now, f.now);
}

export function addSponsorContact(
  f: Fixture,
  id: string,
  sponsorshipId: string,
  eventId: string,
  contactId: string,
  opts: { status?: string; primary?: boolean } = {},
): void {
  f.run(
    `insert into sponsor_contact (id, sponsorship_id, event_id, contact_id, status, is_primary, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    sponsorshipId,
    eventId,
    contactId,
    opts.status ?? "joined",
    opts.primary ? 1 : 0,
    f.now,
    f.now,
  );
}

export function addEventRole(f: Fixture, id: string, eventId: string, contactId: string, role: string): void {
  f.run(`insert into event_role (id, event_id, contact_id, role, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`, id, eventId, contactId, role, f.now, f.now);
}

export const ACCEPTED_SESSIONS: PortalRule = {
  groups: [{ conditions: [{ field: "session_status", op: "is", values: ["accepted"] }] }],
};

/** Gives a session a session_format answer, creating the event's default
 * CFP form and its Format field on first use. */
export function addFormat(f: Fixture, eventId: string, submissionId: string, label: string): void {
  const formId = `form-${eventId}`;
  const fieldId = `format-${eventId}`;
  f.run(
    `insert or ignore into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, 'CFP', 1, ?, ?)`,
    formId,
    eventId,
    f.now,
    f.now,
  );
  f.run(
    `insert or ignore into form_field (id, form_id, section, kind, label, role, created_at, updated_at) values (?, ?, 'session', 'dropdown', 'Format', 'session_format', ?, ?)`,
    fieldId,
    formId,
    f.now,
    f.now,
  );
  f.run(
    `insert into submission_answer (id, submission_id, form_field_id, value_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`,
    `ans-${submissionId}`,
    submissionId,
    fieldId,
    JSON.stringify(label),
    f.now,
    f.now,
  );
}
