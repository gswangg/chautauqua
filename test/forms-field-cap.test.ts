import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_FORM_FIELDS, type FormFieldRow, type FormRow } from "../src/server/repo/forms";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS } from "../src/forms/types";

// DEC-488: MAX_FORM_FIELDS is both the per-form question ceiling and the
// reorder write/echo burst bound.

const FORM: FormRow = {
  id: "form-1",
  eventId: "event-1",
  title: "CFP",
  intro: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracks: null,
};

function makeField(i: number): FormFieldRow {
  return {
    id: `field-${i}`,
    formId: FORM.id,
    section: "session",
    kind: "text",
    label: `Field ${i}`,
    required: false,
    position: i,
    locked: false,
  };
}

let fields: FormFieldRow[] = [];

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    findFormForOrg: vi.fn(async (_db: unknown, formId: string, orgId: string) =>
      formId === FORM.id && orgId === "org-1" ? FORM : null,
    ),
    listFields: vi.fn(async () => fields),
    createField: vi.fn(async (_db: unknown, _formId: string, input: import("../src/server/repo/forms").CreateFieldInput) => {
      const created: FormFieldRow = {
        id: `field-${fields.length}`,
        formId: FORM.id,
        section: input.section,
        kind: input.kind,
        label: input.label,
        required: input.required,
        position: fields.length,
        locked: false,
      };
      fields = [...fields, created];
      return created;
    }),
    reorderFields: vi.fn(async (_db: unknown, _formId: string, orderedIds: string[]) => {
      const byId = new Map(fields.map((f) => [f.id, f]));
      return orderedIds.map((id, i) => ({ ...(byId.get(id) as FormFieldRow), position: i }));
    }),
  };
});

async function buildFormsApp(auth: AuthInfo) {
  const { formsRoutes } = await import("../src/routes/api/forms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", formsRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

async function postField(app: Hono<AppEnv>) {
  return app.request("/api/v1/forms/form-1/fields", {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ section: "session", kind: "text", label: `Field ${fields.length}`, required: false }),
  });
}

describe("DEC-488: MAX_FORM_FIELDS caps a form's field set", () => {
  it("MAX_FORM_FIELDS exceeds the locked-field count createDefaultForm inserts", () => {
    const lockedCount = LOCKED_SESSION_FIELDS.length + LOCKED_SPEAKER_FIELDS.length;
    expect(MAX_FORM_FIELDS).toBeGreaterThan(lockedCount);
  });

  it("the 200th field succeeds and the 201st is rejected naming the limit", async () => {
    fields = [];
    for (let i = 0; i < MAX_FORM_FIELDS - 1; i++) fields.push(makeField(i));
    expect(fields.length).toBe(MAX_FORM_FIELDS - 1);

    const app = await buildFormsApp(ORGANIZER);
    const res200 = await postField(app);
    expect(res200.status).toBe(201);
    expect(fields.length).toBe(MAX_FORM_FIELDS);

    const res201 = await postField(app);
    expect(res201.status).toBe(400);
    const body = (await res201.json()) as { error: { message: string } };
    expect(body.error.message).toContain(String(MAX_FORM_FIELDS));
  });

  it("the reorder route emits {items, total, page, perPage}", async () => {
    fields = [makeField(0), makeField(1), makeField(2)];
    const app = await buildFormsApp(ORGANIZER);
    const res = await app.request("/api/v1/forms/form-1/fields/reorder", {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ orderedIds: ["field-2", "field-0", "field-1"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; page: number; perPage: number };
    expect(body.items.length).toBe(3);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(MAX_FORM_FIELDS);
  });
});
