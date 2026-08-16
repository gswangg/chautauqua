// CFP form-builder repo layer (DEC-012): the only code here that touches
// drizzle row types. Converts to/from the pure src/forms/types.ts shapes.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { FormFieldDef, FormFieldRole, FormFieldRule } from "../../forms/types";
import { parseFieldOptions, parseFieldRule } from "../../forms/field-json";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS, lockedFieldId } from "../../forms/types";
import { DEC_050, DEC_398, DEC_592 } from "../../decisions";
import { chunkIds, chunkRowsForInsert } from "../../lib/chunk";
import { getFieldOptionsByRole } from "./form-roles";

void DEC_050; // per-form locked field ids ('<formId>:<name>') — see createDefaultForm below
void DEC_592; // wave-10 amendment: createDefaultForm mints the two role-tagged
// session_format/audience_level fields below, per src/db/schema/event.ts's role column.
void DEC_398; // createDefaultForm's insert-on-conflict-do-nothing-then-select below resolves two
// concurrent getOrCreateForm racers to exactly one default ('Call for Papers', isDefault:true)
// form -- the same find-or-create shape getOrCreateFormTaskForm (submissions/status.ts) uses
// against form_event_id_title_idx (migrations/0033, UNIQUE(event_id, title)).

export interface FormFieldRow extends FormFieldDef {
  formId: string;
  locked: boolean;
  // role inherited from FormFieldDef (optional: FormFieldRole | null | undefined)
  // so pre-existing test fixtures that construct FormFieldRow literals without
  // it keep compiling -- toFieldRow below always stamps it explicitly.
}

export interface FormRow {
  id: string;
  eventId: string;
  title: string;
  // intro text shown on the public CFP form
  intro: string | null;
  isDefault: boolean;
  openDate: number | null;
  closeDate: number | null;
  tracks: string[] | null;
}

function toFieldRow(row: typeof schema.formField.$inferSelect): FormFieldRow {
  return {
    id: row.id,
    formId: row.formId,
    section: row.section as FormFieldDef["section"],
    kind: row.kind as FormFieldDef["kind"],
    label: row.label,
    helpText: row.helpText ?? undefined,
    required: row.required,
    position: row.position,
    options: parseFieldOptions(row.optionsJson, row.id),
    rule: parseFieldRule(row.ruleJson, row.id),
    locked: row.locked,
    role: (row.role as FormFieldRole | null) ?? null,
  };
}

function toFormRow(row: typeof schema.form.$inferSelect): FormRow {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    intro: row.description,
    isDefault: row.isDefault,
    openDate: row.openDate ? row.openDate.getTime() : null,
    closeDate: row.closeDate ? row.closeDate.getTime() : null,
    tracks: row.tracksJson ? (JSON.parse(row.tracksJson) as string[]) : null,
  };
}

/** Ownership check: does this event belong to the given org? */
export async function findEventForOrg(db: Db, eventId: string, orgId: string) {
  const rows = await db
    .select({ id: schema.event.id, orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const row = rows[0];
  if (!row || row.orgId !== orgId) return null;
  return row;
}

/** The event's DEFAULT form (DEC-398) -- an event may have several forms
 * (the default CFP form plus one per DEC-111 acceptance form-task title,
 * created with isDefault:false), so this is never "the first row"; it's
 * the one row with isDefault = true. */
export async function findFormForEvent(db: Db, eventId: string): Promise<FormRow | null> {
  const rows = await db
    .select()
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true)))
    .limit(1);
  const row = rows[0];
  return row ? toFormRow(row) : null;
}

/** DEC-398: every form on the event (default CFP form plus any DEC-111
 * acceptance form-task forms), default first then title ascending -- the
 * source for the organizer's form-task "pick a form by name" select. */
export async function listFormsForEvent(
  db: Db,
  eventId: string,
): Promise<{ id: string; title: string; isDefault: boolean }[]> {
  const rows = await db
    .select({ id: schema.form.id, title: schema.form.title, isDefault: schema.form.isDefault })
    .from(schema.form)
    .where(eq(schema.form.eventId, eventId))
    .orderBy(asc(schema.form.title));
  return [...rows].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return 0;
  });
}

export async function listFields(db: Db, formId: string): Promise<FormFieldRow[]> {
  const rows = await db
    .select()
    .from(schema.formField)
    .where(eq(schema.formField.formId, formId))
    .orderBy(asc(schema.formField.position));
  return rows.map(toFieldRow);
}

const LOCKED_SESSION_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
};
const LOCKED_SPEAKER_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  // DEC-321: optional profile fields so the public speakers list isn't blank.
  job_title: "Job title",
  company: "Company",
  bio: "Speaker bio",
};
// DEC-321: the three appended locked speaker fields are optional (a).
const OPTIONAL_LOCKED_SPEAKER_FIELDS = new Set<string>(["job_title", "company", "bio"]);
const LOCKED_SPEAKER_KIND: Record<string, "text" | "long_text"> = {
  job_title: "text",
  company: "text",
  bio: "long_text",
};

// Wave-39 (DEC-020 amendment): LOCKED_SESSION_LABELS / LOCKED_SPEAKER_LABELS
// / LOCKED_SPEAKER_KIND are plain object literals — a lookup keyed by a
// prototype name like `constructor`/`toString` would return a function
// instead of falling back to the documented default (the fieldId itself, or
// "text" for kind). Own-property lookup only, matching src/domain/files.ts's
// allowedContentType shape. One reader for the whole module's lookup family.
function ownProperty<T>(map: Record<string, T>, key: string): T | null {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key]! : null;
}

// Test-only re-exports (test/lookup-table-own-property.test.ts) so the
// own-property fix can be asserted directly against these module-private
// tables without a db-backed createDefaultForm harness.
export const LOCKED_SESSION_LABELS_FOR_TEST = LOCKED_SESSION_LABELS;
export const LOCKED_SPEAKER_LABELS_FOR_TEST = LOCKED_SPEAKER_LABELS;
export const LOCKED_SPEAKER_KIND_FOR_TEST = LOCKED_SPEAKER_KIND;
export const ownPropertyForTest = ownProperty;

/**
 * Creates the default CFP form (locked built-ins + empty custom set) for an
 * event that doesn't have one yet, per DEC-008.
 *
 * DEC-398 (wave-56 amendment): form_event_id_title_idx (migrations/0033_
 * form_title_unique.sql) is a real UNIQUE(event_id, title) DB constraint --
 * this insert-on-conflict-do-nothing-then-select is the same find-or-create
 * shape getOrCreateFormTaskForm (repo/submissions/status.ts) uses, so two
 * concurrent getOrCreateForm callers racing to mint the event's default form
 * resolve to exactly one row instead of two (which previously orphaned the
 * loser's locked form_field rows). Locked fields are only inserted when THIS
 * call's own insert actually created the row -- a losing racer must not
 * insert a second set of locked fields onto the winner's form.
 */
export async function createDefaultForm(db: Db, eventId: string): Promise<{ form: FormRow; fields: FormFieldRow[] }> {
  const now = new Date();
  const formId = newId();
  await db
    .insert(schema.form)
    .values({
      id: formId,
      eventId,
      title: "Call for Papers",
      description: null,
      isDefault: true,
      openDate: null,
      closeDate: null,
      tracksJson: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [schema.form.eventId, schema.form.title] });

  // DEC-558 (wave 75): form_event_id_title_idx is a uniqueIndex on
  // (schema.form.eventId, schema.form.title), so this predicate already
  // narrows to at most one row.
  const winner = await db
    .select()
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.title, "Call for Papers")))
    .limit(1);
  const row = winner[0];
  if (!row) throw new Error(`createDefaultForm: no row for (eventId="${eventId}", title="Call for Papers") after insert`);
  if (!row.isDefault) {
    throw new Error(`createDefaultForm: (eventId, 'Call for Papers') resolves to a non-default form`);
  }

  // The insert above used `formId` as its candidate id -- if the winning row
  // carries that exact id, THIS call's own insert is the one that landed (no
  // concurrent racer beat it to the unique (eventId, title) slot), so this
  // call also owns seeding its locked field rows. If some other id won, a
  // racer already created the form (and, per this same invariant, already
  // seeded its fields), so this call must not insert a duplicate set.
  const createdHere = row.id === formId;
  if (createdHere) {
    let position = 0;
    const fieldValues: (typeof schema.formField.$inferInsert)[] = [];
    for (const fieldId of LOCKED_SESSION_FIELDS) {
      fieldValues.push({
        id: lockedFieldId(row.id, fieldId),
        formId: row.id,
        section: "session",
        kind: fieldId === "description" ? "long_text" : "text",
        label: ownProperty(LOCKED_SESSION_LABELS, fieldId) ?? fieldId,
        required: true,
        position: position++,
        optionsJson: null,
        locked: true,
        role: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    // DEC-592 amendment (wave 10, DEC-755): role-tagged Format/Audience
    // level dropdowns, minted with ordinary (non-locked) ids so organizers
    // can still rename/remove them -- the role column, not the id, is what
    // read sites resolve on going forward (w10-b). Placed between the
    // locked session fields and the locked speaker fields; the shared
    // `position` counter keeps running, so speaker fields shift by two.
    fieldValues.push({
      id: newId(),
      formId: row.id,
      section: "session",
      kind: "dropdown",
      label: "Format",
      required: false,
      position: position++,
      optionsJson: JSON.stringify(["Keynote (45 min)", "Talk (30 min)", "Lightning talk (10 min)", "Workshop (90 min)", "Panel (45 min)"]),
      locked: false,
      role: "session_format",
      createdAt: now,
      updatedAt: now,
    });
    fieldValues.push({
      id: newId(),
      formId: row.id,
      section: "session",
      kind: "dropdown",
      label: "Audience level",
      required: false,
      position: position++,
      optionsJson: JSON.stringify(["Beginner", "Intermediate", "Advanced"]),
      locked: false,
      role: "audience_level",
      createdAt: now,
      updatedAt: now,
    });
    for (const fieldId of LOCKED_SPEAKER_FIELDS) {
      fieldValues.push({
        id: lockedFieldId(row.id, fieldId),
        formId: row.id,
        section: "speaker",
        kind: ownProperty(LOCKED_SPEAKER_KIND, fieldId) ?? "text",
        label: ownProperty(LOCKED_SPEAKER_LABELS, fieldId) ?? fieldId,
        required: !OPTIONAL_LOCKED_SPEAKER_FIELDS.has(fieldId),
        position: position++,
        optionsJson: null,
        locked: true,
        role: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    // DEC-528: 10 field rows (8 locked + 2 role-tagged) x 12 columns = 120
    // against chunkRowsForInsert's own MAX_D1_BOUND_PARAMS-10 budget —
    // chunked by bound-parameter budget (columns-per-row derived), never a
    // hand-declared count that drifts silently when a column is added.
    for (const chunk of chunkRowsForInsert(fieldValues)) {
      await db.insert(schema.formField).values(chunk);
    }
  }

  const form = toFormRow(row);
  const fields = await listFields(db, row.id);
  return { form, fields };
}

/** Reads the event's CFP form + ordered fields, creating the default form on
 * first read if none exists yet (DEC-008). createDefaultForm itself is
 * race-safe (DEC-398 amendment), so there is no second creation attempt or
 * silent second default form here. */
export async function getOrCreateForm(db: Db, eventId: string): Promise<{ form: FormRow; fields: FormFieldRow[] }> {
  const existing = await findFormForEvent(db, eventId);
  if (existing) {
    const fields = await listFields(db, existing.id);
    return { form: existing, fields };
  }
  return createDefaultForm(db, eventId);
}

/** DEC-755: the session_format-role field's own dropdown options, as
 * declared on the event's default form -- the ONE source both the "New
 * submission" dialog's <select> and the create/PATCH route's format
 * validation read from. Returns null when the event's default form has no
 * such field (a supplied format value is then a validation error, never a
 * silent drop), or `[]` when the field exists but has no options defined.
 * Delegates to getFieldOptionsByRole (form-roles.ts). */
export async function getFormatFieldOptions(db: Db, eventId: string): Promise<string[] | null> {
  return getFieldOptionsByRole(db, eventId, "session_format");
}

export async function findFormById(db: Db, formId: string): Promise<FormRow | null> {
  const rows = await db.select().from(schema.form).where(eq(schema.form.id, formId)).limit(1);
  const row = rows[0];
  return row ? toFormRow(row) : null;
}

export interface FormPatch {
  intro?: string | null;
  openDate?: number | null;
  closeDate?: number | null;
  tracks?: string[] | null;
}

export async function patchForm(db: Db, formId: string, patch: FormPatch): Promise<FormRow> {
  await db
    .update(schema.form)
    .set({
      description: patch.intro !== undefined ? patch.intro : undefined,
      openDate: patch.openDate !== undefined ? (patch.openDate === null ? null : new Date(patch.openDate)) : undefined,
      closeDate: patch.closeDate !== undefined ? (patch.closeDate === null ? null : new Date(patch.closeDate)) : undefined,
      tracksJson:
        patch.tracks !== undefined ? (patch.tracks && patch.tracks.length > 0 ? JSON.stringify(patch.tracks) : null) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.form.id, formId));

  const updated = await findFormById(db, formId);
  if (!updated) throw new Error(`form ${formId} not found after update`);
  return updated;
}

export async function findFieldById(db: Db, fieldId: string): Promise<FormFieldRow | null> {
  const rows = await db.select().from(schema.formField).where(eq(schema.formField.id, fieldId)).limit(1);
  const row = rows[0];
  return row ? toFieldRow(row) : null;
}

export interface CreateFieldInput {
  section: FormFieldDef["section"];
  kind: FormFieldDef["kind"];
  label: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  rule?: FormFieldRule;
}

export async function createField(db: Db, formId: string, input: CreateFieldInput): Promise<FormFieldRow> {
  const existing = await listFields(db, formId);
  const maxPosition = existing.reduce((max, f) => Math.max(max, f.position), -1);
  const now = new Date();
  const id = newId();
  await db.insert(schema.formField).values({
    id,
    formId,
    section: input.section,
    kind: input.kind,
    label: input.label,
    helpText: input.helpText ?? null,
    required: input.required,
    position: maxPosition + 1,
    optionsJson: input.options ? JSON.stringify(input.options) : null,
    ruleJson: input.rule ? JSON.stringify(input.rule) : null,
    locked: false,
    createdAt: now,
    updatedAt: now,
  });
  const created = await findFieldById(db, id);
  if (!created) throw new Error("field insert did not persist");
  return created;
}

export interface FieldPatch {
  label?: string;
  helpText?: string | null;
  required?: boolean;
  options?: string[] | null;
  rule?: FormFieldRule | null;
  section?: FormFieldDef["section"];
  kind?: FormFieldDef["kind"];
  // DEC-592 (findings wave 13): undefined = untouched, null = clear the
  // role, a FormFieldRole = grant it.
  role?: FormFieldRole | null;
}

export async function patchField(db: Db, fieldId: string, patch: FieldPatch): Promise<FormFieldRow> {
  // DEC-500/DEC-505: options exist only on dropdowns. A kind change away
  // from dropdown must clear stored options in the same UPDATE, unless the
  // caller is explicitly setting options in this same patch.
  const clearOptionsForKindChange = patch.kind !== undefined && patch.kind !== "dropdown";
  await db
    .update(schema.formField)
    .set({
      label: patch.label,
      helpText: patch.helpText !== undefined ? patch.helpText : undefined,
      required: patch.required,
      section: patch.section,
      kind: patch.kind,
      optionsJson:
        patch.options !== undefined
          ? patch.options
            ? JSON.stringify(patch.options)
            : null
          : clearOptionsForKindChange
            ? null
            : undefined,
      ruleJson: patch.rule !== undefined ? (patch.rule ? JSON.stringify(patch.rule) : null) : undefined,
      role: patch.role !== undefined ? patch.role : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.formField.id, fieldId));
  const updated = await findFieldById(db, fieldId);
  if (!updated) throw new Error(`field ${fieldId} not found after update`);
  return updated;
}

/** DEC-592 (findings wave 13): the field, if any, already holding `role` on
 * `formId` -- read before a grant so the route can 400 naming the incumbent
 * instead of the DB silently ending up with two. Set-based (one query, no
 * per-field loop). */
export async function findFieldByRole(db: Db, formId: string, role: FormFieldRole): Promise<FormFieldRow | null> {
  const rows = await db
    .select()
    .from(schema.formField)
    .where(and(eq(schema.formField.formId, formId), eq(schema.formField.role, role)))
    .limit(1);
  const row = rows[0];
  return row ? toFieldRow(row) : null;
}

/** DEC-300: what would silently break if `fieldId` were deleted right now —
 * sibling fields whose visibility rule targets it, plus the count of
 * submission_answer rows recorded against it. Both sides are things a bare
 * delete would orphan without warning. */
export async function describeFieldDependents(
  db: Db,
  formId: string,
  fieldId: string,
): Promise<{ dependentLabels: string[]; answerCount: number }> {
  const siblings = await listFields(db, formId);
  const dependentLabels = siblings.filter((f) => f.id !== fieldId && f.rule?.fieldId === fieldId).map((f) => f.label);

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.formFieldId, fieldId));
  const answerCount = Number(countRows[0]?.count ?? 0);

  return { dependentLabels, answerCount };
}

/** DEC-505: how many collected answers reference each stored option value of
 * `fieldId` — a single-select answer contributes one count against its
 * stored string value; a multi-select answer (stored as an array) contributes
 * one count against every element. Used to refuse removing an option that
 * submissions have already answered. Non-string values (and non-string array
 * elements) are ignored — they're not option-value answers. */
export async function countAnswersByOptionValue(db: Db, fieldId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ valueJson: schema.submissionAnswer.valueJson })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.formFieldId, fieldId));

  const counts = new Map<string, number>();
  for (const row of rows) {
    const value: unknown = JSON.parse(row.valueJson); // fail loudly: stored value_json must be valid JSON
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (typeof v !== "string") continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return counts;
}

/** DEC-505 (amendment, wave 49): clears exactly the given fields' stored
 * rules, in one set-based UPDATE (no per-row loop) — used by PATCH
 * /api/v1/fields/:fieldId's `?cascade=1` path when a kind/option edit
 * invalidates one or more sibling rules that target the patched field.
 * Returns the number of rows cleared. */
export async function clearFieldRules(db: Db, fieldIds: string[]): Promise<number> {
  if (fieldIds.length === 0) return 0;
  // DEC-078: the sibling list is bounded only by MAX_FORM_FIELDS (200), well
  // over D1's bound-parameter ceiling, so the UPDATE is batched through the
  // canonical chunkIds rather than issued as one unbounded inArray.
  const now = new Date();
  for (const batch of chunkIds(fieldIds)) {
    await db
      .update(schema.formField)
      .set({ ruleJson: null, updatedAt: now })
      .where(inArray(schema.formField.id, batch));
  }
  return fieldIds.length;
}

/** DEC-300: declared cascade — clears dependent siblings' rules (they become
 * unconditional/always-visible rather than referencing a field that no
 * longer exists), deletes the field's collected answers, then the field
 * itself. */
export async function deleteFieldCascade(
  db: Db,
  formId: string,
  fieldId: string,
): Promise<{ clearedRules: number; deletedAnswers: number }> {
  const siblings = await listFields(db, formId);
  const dependents = siblings.filter((f) => f.id !== fieldId && f.rule?.fieldId === fieldId);

  for (const dependent of dependents) {
    await db.update(schema.formField).set({ ruleJson: null, updatedAt: new Date() }).where(eq(schema.formField.id, dependent.id));
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.formFieldId, fieldId));
  const deletedAnswers = Number(countRows[0]?.count ?? 0);
  await db.delete(schema.submissionAnswer).where(eq(schema.submissionAnswer.formFieldId, fieldId));

  await db.delete(schema.formField).where(eq(schema.formField.id, fieldId));

  return { clearedRules: dependents.length, deletedAnswers };
}

export async function reorderFields(db: Db, formId: string, orderedIds: string[]): Promise<FormFieldRow[]> {
  for (let i = 0; i < orderedIds.length; i++) {
    const fieldId = orderedIds[i];
    if (fieldId === undefined) continue;
    await db
      .update(schema.formField)
      .set({ position: i, updatedAt: new Date() })
      .where(and(eq(schema.formField.id, fieldId), eq(schema.formField.formId, formId)));
  }
  return listFields(db, formId);
}

/** Ownership check: does this form belong to the given org (via its event)? */
export async function findFormForOrg(db: Db, formId: string, orgId: string): Promise<FormRow | null> {
  const form = await findFormById(db, formId);
  if (!form) return null;
  const event = await findEventForOrg(db, form.eventId, orgId);
  if (!event) return null;
  return form;
}

/** Ownership check: does this field belong to the given org (via its form -> event)? */
export async function findFieldForOrg(db: Db, fieldId: string, orgId: string): Promise<FormFieldRow | null> {
  const field = await findFieldById(db, fieldId);
  if (!field) return null;
  const form = await findFormForOrg(db, field.formId, orgId);
  if (!form) return null;
  return field;
}
