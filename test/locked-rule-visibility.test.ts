// DEC-475/DEC-486: a conditional rule whose trigger is a locked built-in
// field must not be silently dead. Covers:
//  1. projectFieldForAnswers (unit) — id + rule.fieldId normalized together.
//  2. isVisible/validateAnswers (pure-core) — required-and-visible now
//     reports 'required' instead of being silently dropped; hidden is still
//     stripped; ops 'eq'/'ne'/'in' all covered.
//  3. route-level — the public CFP submit path, exercising the real repo
//     mapping (src/server/repo/submit.ts getFormFields) end to end.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { projectFieldForAnswers, type FormFieldDef } from "../src/forms/types";
import { isVisible, resolveHiddenFieldIds } from "../src/forms/visibility";
import { validateAnswers } from "../src/forms/validate";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import type { R2Bucket } from "@cloudflare/workers-types";

describe("projectFieldForAnswers (DEC-475/DEC-486)", () => {
  it("normalizes both id and rule.fieldId from raw locked PKs in one pass", () => {
    const def: FormFieldDef = {
      id: "form-1:description",
      section: "session",
      kind: "text",
      label: "Description",
      required: true,
      position: 0,
      rule: { fieldId: "form-1:title", op: "eq", value: "yes" },
    };
    const projected = projectFieldForAnswers(def);
    expect(projected.id).toBe("description");
    expect(projected.rule?.fieldId).toBe("title");
  });

  it("leaves non-locked ids untouched, with or without a rule", () => {
    const noRule: FormFieldDef = {
      id: "extra_notes",
      section: "session",
      kind: "text",
      label: "Notes",
      required: false,
      position: 0,
    };
    expect(projectFieldForAnswers(noRule)).toEqual(noRule);

    const withRule: FormFieldDef = {
      id: "extra_notes",
      section: "session",
      kind: "text",
      label: "Notes",
      required: false,
      position: 0,
      rule: { fieldId: "wants_slides", op: "eq", value: "yes" },
    };
    expect(projectFieldForAnswers(withRule)).toEqual(withRule);
  });

  it("normalizes a rule fieldId referencing a locked field even when the field's own id is not locked", () => {
    const def: FormFieldDef = {
      id: "extra_notes",
      section: "session",
      kind: "text",
      label: "Notes",
      required: false,
      position: 0,
      rule: { fieldId: "form-1:email", op: "ne", value: "" },
    };
    expect(projectFieldForAnswers(def).rule?.fieldId).toBe("email");
  });
});

describe("isVisible + validateAnswers with a locked trigger field (DEC-475)", () => {
  function fieldsFor(op: "eq" | "ne" | "in", value: unknown): [FormFieldDef, FormFieldDef] {
    return [
      {
        id: "title",
        section: "session",
        kind: "text",
        label: "Title",
        required: true,
        position: 0,
      },
      {
        id: "extra_notes",
        section: "session",
        kind: "text",
        label: "Extra notes",
        required: true,
        position: 1,
        rule: { fieldId: "title", op, value },
      },
    ];
  }

  it("op 'eq': visible-and-absent now reports required (previously silently dropped)", () => {
    const fields = fieldsFor("eq", "Show it");
    const answers = { title: "Show it" };
    expect(isVisible(fields[1], answers, "text")).toBe(true);
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.extra_notes).toBe("required");
  });

  it("op 'eq': hidden answers are stripped from cleaned, not validated", () => {
    const fields = fieldsFor("eq", "Show it");
    const answers = { title: "Do not show", extra_notes: "should be stripped" };
    expect(isVisible(fields[1], answers, "text")).toBe(false);
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cleaned.extra_notes).toBeUndefined();
  });

  it("op 'ne': visible-and-absent reports required", () => {
    const fields = fieldsFor("ne", "Hide it");
    const answers = { title: "Show it" };
    expect(isVisible(fields[1], answers, "text")).toBe(true);
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.extra_notes).toBe("required");
  });

  it("op 'ne': matching trigger value hides and strips", () => {
    const fields = fieldsFor("ne", "Hide it");
    const answers = { title: "Hide it", extra_notes: "should be stripped" };
    expect(isVisible(fields[1], answers, "text")).toBe(false);
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cleaned.extra_notes).toBeUndefined();
  });

  it("op 'in': visible-and-absent reports required", () => {
    const fields = fieldsFor("in", ["A", "B"]);
    const answers = { title: "A" };
    expect(isVisible(fields[1], answers, "text")).toBe(true);
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.extra_notes).toBe("required");
  });

  it("op 'in': non-matching trigger value hides and strips", () => {
    const fields = fieldsFor("in", ["A", "B"]);
    const answers = { title: "C", extra_notes: "should be stripped" };
    expect(isVisible(fields[1], answers, "text")).toBe(false);
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cleaned.extra_notes).toBeUndefined();
  });
});

describe("resolveHiddenFieldIds: a locked built-in is never hidden (DEC-625)", () => {
  it("a rule that is false on the locked 'title' field still leaves it visible", () => {
    // 'title' itself is normally rule-free, but simulate a stray/legacy
    // rule on a locked field (e.g. pre-DEC-625 data) whose condition is
    // false against the current answers -- it must NOT end up in the
    // hidden set.
    const fields: FormFieldDef[] = [
      {
        id: "title",
        section: "session",
        kind: "text",
        label: "Title",
        required: true,
        position: 0,
        rule: { fieldId: "extra_notes", op: "eq", value: "show title" },
      },
      {
        id: "extra_notes",
        section: "session",
        kind: "text",
        label: "Extra notes",
        required: false,
        position: 1,
      },
    ];
    const answers = { extra_notes: "does not match" };
    const hidden = resolveHiddenFieldIds(fields, answers);
    expect(hidden.has("title")).toBe(false);
  });

  it("a locked 'email' field with a rule pointing at a missing field is still never hidden", () => {
    const fields: FormFieldDef[] = [
      {
        id: "email",
        section: "speaker",
        kind: "text",
        label: "Email",
        required: true,
        position: 0,
        rule: { fieldId: "no_such_field", op: "eq", value: "x" },
      },
    ];
    const hidden = resolveHiddenFieldIds(fields, {});
    expect(hidden.has("email")).toBe(false);
  });

  it("also holds for a raw per-form-PK locked id ('form-1:title')", () => {
    const fields: FormFieldDef[] = [
      {
        id: "form-1:title",
        section: "session",
        kind: "text",
        label: "Title",
        required: true,
        position: 0,
        rule: { fieldId: "extra_notes", op: "eq", value: "show title" },
      },
      {
        id: "extra_notes",
        section: "session",
        kind: "text",
        label: "Extra notes",
        required: false,
        position: 1,
      },
    ];
    const hidden = resolveHiddenFieldIds(fields, { extra_notes: "no match" });
    expect(hidden.has("form-1:title")).toBe(false);
  });
});

describe("validateAnswers: a locked email field with a false-evaluating rule is still validated (DEC-625)", () => {
  it("an invalid email on a locked 'email' field with a rule fails validation instead of being stripped as hidden", () => {
    const fields: FormFieldDef[] = [
      {
        id: "extra_notes",
        section: "session",
        kind: "text",
        label: "Extra notes",
        required: false,
        position: 0,
      },
      {
        id: "email",
        section: "speaker",
        kind: "text",
        label: "Email",
        required: true,
        position: 1,
        // Rule condition is false against the given answers -- if the
        // locked field were hideable, this would strip it and the bad
        // email would never be validated.
        rule: { fieldId: "extra_notes", op: "eq", value: "show email" },
      },
    ];
    const answers = { extra_notes: "does not match", email: "not-an-email" };
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toBe("must be a valid email address");
  });
});

// --- Route-level: public CFP submit, real getFormFields repo mapping. ---
// Mirrors the fakeDb pattern from test/submit-hidden-file-field.test.ts.

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const TRACK_ROW = { id: "track-1", name: "Main Track" };

// extra_notes' rule references the locked 'title' field via its RAW
// per-form PK ('form-1:title') — exactly how the builder stores it
// (src/forms/builder.ts validateRuleReference). getFormFields must resolve
// this to the short 'title' key for isVisible/validateAnswers to work.
const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  {
    id: "extra_notes",
    section: "session",
    kind: "text",
    label: "Extra notes",
    helpText: null,
    required: true,
    position: 2,
    optionsJson: null,
    ruleJson: JSON.stringify({ fieldId: "form-1:title", op: "eq", value: "yes please" }),
  },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 5, optionsJson: null, ruleJson: null },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const inserts: any[] = [];
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({
      values: (vals: unknown) => {
        inserts.push(vals);
        // DEC-948: checkAndIncrementScopedLimit chains
        // .onConflictDoUpdate(...).returning(...) for its atomic D1 upsert;
        // a minimal always-under-cap fake is enough since this test doesn't
        // assert on rate-limit state.
        return {
          then: (resolve: (v: undefined) => void) => resolve(undefined),
          onConflictDoUpdate: () => ({
            returning: async () => [{ count: 1 }],
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        };
      },
    }),
    delete: () => ({ where: async () => {} }),
  };
  return { db: db as unknown as AppEnv["Variables"]["db"], inserts };
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function fakeFilesBucket() {
  const bucket = {
    async put() {},
    async get() {
      return null;
    },
    async delete() {},
  } as unknown as R2Bucket;
  return bucket;
}

function appWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

const CSRF_TOKEN = "test-csrf-token";

function submitForm(opts: { title: string; extraNotes?: string }) {
  const form = new FormData();
  form.set(CSRF_COOKIE_NAME, CSRF_TOKEN);
  form.set("field__title", opts.title);
  form.set("field__description", "A talk about things.");
  if (opts.extraNotes !== undefined) form.set("field__extra_notes", opts.extraNotes);
  form.set("field__first_name", "Ada");
  form.set("field__last_name", "Lovelace");
  form.set("field__email", "ada@example.com");
  form.set("trackIds", "track-1");
  return new Request("http://local/submit/test-conf", {
    method: "POST",
    headers: { cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
    body: form,
  });
}

function selectQueueFor() {
  return [[EVENT_ROW], [FORM_ROW], FIELD_ROWS, [TRACK_ROW], [], [{ seq: 3 }], []];
}

async function run(db: AppEnv["Variables"]["db"], req: Request) {
  const app = appWithDb(db);
  return app.request(req, undefined, {
    KV: fakeKv(),
    FILES: fakeFilesBucket(),
    DEV_MODE: "1",
  } as unknown as AppEnv["Bindings"]);
}

describe("public submit route: locked-field-triggered rule (DEC-475/DEC-486)", () => {
  it("trigger visible (title matches), extra_notes omitted -> 400 with 'required' for extra_notes", async () => {
    const { db } = fakeDb(selectQueueFor());
    const req = submitForm({ title: "yes please" });
    const res = await run(db, req);
    expect(res.status).toBe(400);
    const html = await res.text();
    // The dependent field's wrap div must be rendered visible (no
    // display:none) and carry the 'required' error — proof the trigger
    // 'title' resolved and matched, not silently undefined.
    expect(html).toMatch(/id="chq-field-wrap-extra_notes" class="chq-field">/);
    expect(html).not.toMatch(/id="chq-field-wrap-extra_notes"[^>]*style="display:none"/);
    expect(html).toContain('data-field-id="extra_notes"');
    expect(html).toMatch(/chq-field-error">\s*required/);
  });

  it("trigger hidden (title doesn't match), extra_notes omitted -> 200 success", async () => {
    const { db } = fakeDb(selectQueueFor());
    const req = submitForm({ title: "no thanks" });
    const res = await run(db, req);
    expect(res.status).toBe(200);
  });
});
