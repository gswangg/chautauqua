// DEC-592 amendment (findings wave 13): form_field.role is a two-way door.
// PATCH /api/v1/fields/:fieldId now accepts `role` (grant/clear), enforcing
// dropdown+session shape and (form, role) uniqueness; DELETE refuses a
// role-tagged field outright. Two halves, mirroring the two established
// fixture styles in this area:
//  - repo-level, real-SQLite-migrated DB (test/form-field-role.test.ts's
//    harness) for the resolution round-trip (grant -> getEventFieldIdByRole
//    / getFieldOptionsByRole).
//  - route-level, mocked repo module (test/forms-field-kind-patch.test.ts's
//    pattern) for the validation refusals, which don't need a real DB.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { newId } from "../src/domain/ids";
import { getEventFieldIdByRole, getFieldOptionsByRole } from "../src/server/repo/form-roles";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { FormFieldRow } from "../src/server/repo/forms";

// The below `vi.mock("../src/server/repo/forms", ...)` (for the route-level
// half of this file) is hoisted and applies to EVERY import of that module
// in this file -- including a plain `import { createField } from
// "../src/server/repo/forms"` up here. So the DB-backed half below reaches
// past the mock via vi.importActual, resolved once in beforeAll, instead of
// a static import.
let realRepo: typeof import("../src/server/repo/forms");

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
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

const ORG_ID = "org-1";
const EVENT_ID = "event-1";

function seedEvent(sqlite: DatabaseSync, eventId: string, slug: string) {
  const now = Date.now();
  sqlite.prepare(`insert into org (id, name, created_at, updated_at) values (?, 'Org', ?, ?)`).run(ORG_ID, now, now);
  sqlite
    .prepare(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, created_at, updated_at)
       values (?, ?, 'Event', ?, '2026-01-01', '2026-01-02', 'America/New_York', ?, ?)`,
    )
    .run(eventId, ORG_ID, slug, now, now);
}

function seedForm(sqlite: DatabaseSync, formId: string, eventId: string) {
  const now = Date.now();
  sqlite
    .prepare(`insert into form (id, event_id, title, is_default, created_at, updated_at) values (?, ?, 'Call for Papers', 1, ?, ?)`)
    .run(formId, eventId, now, now);
}

describe("form_field.role grant/clear via patchField (DEC-592 amendment, findings wave 13)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  let formId: string;

  beforeAll(async () => {
    realRepo = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  });

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    seedEvent(sqlite, EVENT_ID, "event-1");
    formId = newId();
    seedForm(sqlite, formId, EVENT_ID);
  });

  it("granting session_format to a session dropdown makes it resolve via getEventFieldIdByRole/getFieldOptionsByRole", async () => {
    const field = await realRepo.createField(db, formId, {
      section: "session",
      kind: "dropdown",
      label: "Format",
      required: false,
      options: ["Talk", "Workshop"],
    });

    expect(await getEventFieldIdByRole(db, EVENT_ID, "session_format")).toBeNull();

    await realRepo.patchField(db, field.id, { role: "session_format" });

    expect(await getEventFieldIdByRole(db, EVENT_ID, "session_format")).toBe(field.id);
    expect(await getFieldOptionsByRole(db, EVENT_ID, "session_format")).toEqual(["Talk", "Workshop"]);
  });

  it("clearing a role removes it from resolution", async () => {
    const field = await realRepo.createField(db, formId, {
      section: "session",
      kind: "dropdown",
      label: "Audience",
      required: false,
      options: ["Beginner"],
    });
    await realRepo.patchField(db, field.id, { role: "audience_level" });
    expect(await getEventFieldIdByRole(db, EVENT_ID, "audience_level")).toBe(field.id);

    await realRepo.patchField(db, field.id, { role: null });
    expect(await getEventFieldIdByRole(db, EVENT_ID, "audience_level")).toBeNull();
    const reread = await realRepo.findFieldById(db, field.id);
    expect(reread?.role ?? null).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Route-level validation, mocked repo (test/forms-field-kind-patch.test.ts's
// pattern) -- these exercise the 400 refusals that don't need a real DB.

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const { SESSION_DROPDOWN, ROLE_TAGGED_FORMAT, TEXT_FIELD, SPEAKER_DROPDOWN, SECOND_SESSION_DROPDOWN } = vi.hoisted(() => ({
  SESSION_DROPDOWN: {
    id: "field-session-dropdown",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Format",
    required: false,
    position: 0,
    locked: false,
    options: ["Talk", "Workshop"],
    role: null,
  },
  ROLE_TAGGED_FORMAT: {
    id: "field-role-tagged",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Session format",
    required: false,
    position: 1,
    locked: false,
    options: ["Talk", "Workshop"],
    role: "session_format" as const,
  },
  TEXT_FIELD: {
    id: "field-text",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Materials",
    required: false,
    position: 2,
    locked: false,
    role: null,
  },
  SPEAKER_DROPDOWN: {
    id: "field-speaker-dropdown",
    formId: "form-1",
    section: "speaker" as const,
    kind: "dropdown" as const,
    label: "T-shirt size",
    required: false,
    position: 3,
    locked: false,
    options: ["S", "M", "L"],
    role: null,
  },
  SECOND_SESSION_DROPDOWN: {
    id: "field-second-session-dropdown",
    formId: "form-1",
    section: "session" as const,
    kind: "dropdown" as const,
    label: "Track",
    required: false,
    position: 4,
    locked: false,
    options: ["A", "B"],
    role: null,
  },
}));

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const FIELDS: Record<string, FormFieldRow> = {
    [SESSION_DROPDOWN.id]: { ...SESSION_DROPDOWN },
    [ROLE_TAGGED_FORMAT.id]: { ...ROLE_TAGGED_FORMAT },
    [TEXT_FIELD.id]: { ...TEXT_FIELD },
    [SPEAKER_DROPDOWN.id]: { ...SPEAKER_DROPDOWN },
    [SECOND_SESSION_DROPDOWN.id]: { ...SECOND_SESSION_DROPDOWN },
  };
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && FIELDS[fieldId] ? { ...FIELDS[fieldId] } : null,
    ),
    listFields: vi.fn(async (_db: unknown, formId: string) => Object.values(FIELDS).filter((f) => f.formId === formId)),
    describeFieldDependents: vi.fn(async () => ({ dependentLabels: [], answerCount: 0 })),
    findFieldByRole: vi.fn(async (_db: unknown, formId: string, role: string) => {
      const found = Object.values(FIELDS).find((f) => f.formId === formId && f.role === role);
      return found ? { ...found } : null;
    }),
    patchField: vi.fn(
      async (
        _db: unknown,
        fieldId: string,
        patch: { label?: string; section?: FormFieldRow["section"]; kind?: FormFieldRow["kind"]; role?: string | null },
      ) => {
        const current = FIELDS[fieldId];
        if (!current) throw new Error("not found");
        if (patch.section !== undefined) current.section = patch.section;
        if (patch.kind !== undefined) current.kind = patch.kind;
        if (patch.role !== undefined) current.role = patch.role as never;
        FIELDS[fieldId] = current;
        return { ...current };
      },
    ),
    deleteFieldCascade: vi.fn(async () => ({ clearedRules: 0, deletedAnswers: 0 })),
  };
});

async function buildApp() {
  const { formsRoutes } = await import("../src/routes/api/forms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", ORGANIZER);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", formsRoutes);
  return app;
}

function patch(app: Hono<AppEnv>, path: string, body: unknown) {
  return app.request(path, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function del(app: Hono<AppEnv>, path: string) {
  return app.request(path, { method: "DELETE", headers: { "x-chq-csrf": "1" } });
}

describe("PATCH /api/v1/fields/:fieldId — role (DEC-592 amendment, findings wave 13)", () => {
  it("grants a role to a session dropdown", async () => {
    const app = await buildApp();
    // audience_level is unclaimed by any fixture field (only ROLE_TAGGED_
    // FORMAT holds session_format), so this is a clean grant with no
    // incumbent collision.
    const res = await patch(app, `/api/v1/fields/${SESSION_DROPDOWN.id}`, { role: "audience_level" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { role?: string | null };
    expect(body.role).toBe("audience_level");
  });

  it("400s granting a role to a text field", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${TEXT_FIELD.id}`, { role: "session_format" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.role).toBeDefined();
  });

  it("400s granting a role to a speaker-section dropdown field", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${SPEAKER_DROPDOWN.id}`, { role: "session_format" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.role).toBeDefined();
  });

  it("400s granting a role that's already held by another field, naming the incumbent", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${SECOND_SESSION_DROPDOWN.id}`, { role: "session_format" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.message).toContain(ROLE_TAGGED_FORMAT.label);
    expect(body.error.message).toContain(ROLE_TAGGED_FORMAT.id);
  });

  it("400s changing a role-tagged field's kind", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${ROLE_TAGGED_FORMAT.id}`, { kind: "text" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.kind).toBeDefined();
  });

  it("400s changing a role-tagged field's section", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${ROLE_TAGGED_FORMAT.id}`, { section: "speaker" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.section).toBeDefined();
  });

  it("400s an unrecognized role value", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${SESSION_DROPDOWN.id}`, { role: "not_a_role" });
    expect(res.status).toBe(400);
  });

});

describe("DELETE /api/v1/fields/:fieldId — role-tagged refusal (DEC-592 amendment, findings wave 13)", () => {
  // These two run in this order against the shared mocked FIELDS store
  // (see the vi.mock factory above): the refusal must be observed BEFORE
  // the role is cleared, since clearing it is what makes the subsequent
  // delete legal -- reversing the order would make the refusal
  // unobservable (the field's role would already be null).
  it("400s deleting a role-tagged field, keyed role", async () => {
    const app = await buildApp();
    const res = await del(app, `/api/v1/fields/${ROLE_TAGGED_FORMAT.id}`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.role).toBeDefined();
  });

  it("clearing a role then deleting the field succeeds", async () => {
    const app = await buildApp();
    const cleared = await patch(app, `/api/v1/fields/${ROLE_TAGGED_FORMAT.id}`, { role: null });
    expect(cleared.status).toBe(200);
    const clearedBody = (await cleared.json()) as { role?: string | null };
    expect(clearedBody.role ?? null).toBeNull();

    const deleted = await del(app, `/api/v1/fields/${ROLE_TAGGED_FORMAT.id}`);
    expect(deleted.status).toBe(200);
  });
});
