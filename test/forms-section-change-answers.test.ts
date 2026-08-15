// DEC-505 amendment (wave 54): this overrules DEC-505's original "section is
// pure grouping" clause. Section is the anonymisation boundary — speaker-
// section answers are hidden from reviewers on an anonymised plan,
// session-section answers are not — so a section change with collected
// answers is refused with the same 409 conflict shape as a kind change.
// A body whose section equals the current section is a no-op, not a
// refusal, even when answers exist. Both guards (kind + section) read one
// describeFieldDependents call.
//
// Route-level tests, mocking the repo module out from under the route per
// test/forms-field-kind-patch.test.ts's established pattern.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { FormFieldRow } from "../src/server/repo/forms";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "org-1" };

const { ANSWERED_FIELD, ANSWER_FREE_FIELD } = vi.hoisted(() => ({
  ANSWERED_FIELD: {
    id: "field-answered",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Bio",
    required: false,
    position: 0,
    locked: false,
  },
  ANSWER_FREE_FIELD: {
    id: "field-free",
    formId: "form-1",
    section: "session" as const,
    kind: "text" as const,
    label: "Notes",
    required: false,
    position: 1,
    locked: false,
  },
}));

let describeFieldDependentsCalls = 0;

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  const FIELDS: Record<string, FormFieldRow> = {
    [ANSWERED_FIELD.id]: { ...ANSWERED_FIELD },
    [ANSWER_FREE_FIELD.id]: { ...ANSWER_FREE_FIELD },
  };
  return {
    ...actual,
    findFieldForOrg: vi.fn(async (_db: unknown, fieldId: string, orgId: string) =>
      orgId === "org-1" && FIELDS[fieldId] ? { ...FIELDS[fieldId] } : null,
    ),
    listFields: vi.fn(async (_db: unknown, formId: string) =>
      Object.values(FIELDS).filter((f) => f.formId === formId),
    ),
    describeFieldDependents: vi.fn(async (_db: unknown, _formId: string, fieldId: string) => {
      describeFieldDependentsCalls += 1;
      return fieldId === ANSWERED_FIELD.id
        ? { dependentLabels: [], answerCount: 6 }
        : { dependentLabels: [], answerCount: 0 };
    }),
    patchField: vi.fn(
      async (
        _db: unknown,
        fieldId: string,
        patch: { label?: string; section?: FormFieldRow["section"]; kind?: FormFieldRow["kind"] },
      ) => {
        const current = FIELDS[fieldId];
        if (!current) throw new Error("not found");
        if (patch.label !== undefined) current.label = patch.label;
        if (patch.section !== undefined) current.section = patch.section;
        if (patch.kind !== undefined) current.kind = patch.kind;
        FIELDS[fieldId] = current;
        return { ...current };
      },
    ),
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

describe("PATCH /api/v1/fields/:fieldId — section change vs. collected answers (DEC-505 wave-54 amendment)", () => {
  it("409s a section change with the answer count when answers exist, leaving the field unchanged", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${ANSWERED_FIELD.id}`, { section: "speaker" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(body.error.message).toMatch(/6 collected answers/);
    expect(body.error.message).toMatch(/speaker and session sections/);
    expect(body.error.fields?.answers).toBe("6");

    const reread = await patch(app, `/api/v1/fields/${ANSWERED_FIELD.id}`, { label: "Bio" });
    const rereadBody = (await reread.json()) as { section?: string };
    expect(rereadBody.section).toBe("session");
  });

  it("200s a section change when the field has zero collected answers", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${ANSWER_FREE_FIELD.id}`, { section: "speaker" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { section?: string };
    expect(body.section).toBe("speaker");
  });

  it("treats a body whose section equals the current section as a no-op, even with answers", async () => {
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${ANSWERED_FIELD.id}`, { section: "session", label: "Bio v2" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { section?: string; label?: string };
    expect(body.section).toBe("session");
    expect(body.label).toBe("Bio v2");
  });

  it("issues exactly one describeFieldDependents call when both kind and section change", async () => {
    describeFieldDependentsCalls = 0;
    const app = await buildApp();
    const res = await patch(app, `/api/v1/fields/${ANSWER_FREE_FIELD.id}`, { kind: "long_text", section: "speaker" });
    expect(res.status).toBe(200);
    expect(describeFieldDependentsCalls).toBe(1);
  });
});
