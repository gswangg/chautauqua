// CFP form-builder repo layer (DEC-012): the only code here that touches
// drizzle row types. Converts to/from the pure src/forms/types.ts shapes.

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { FormFieldDef, FormFieldRule } from "../../forms/types";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS, lockedFieldId } from "../../forms/types";
import { DEC_050 } from "../../decisions";

void DEC_050; // per-form locked field ids ('<formId>:<name>') — see createDefaultForm below

export interface FormFieldRow extends FormFieldDef {
  formId: string;
  locked: boolean;
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
    options: row.optionsJson ? (JSON.parse(row.optionsJson) as string[]) : undefined,
    rule: row.ruleJson ? (JSON.parse(row.ruleJson) as FormFieldRule) : undefined,
    locked: row.locked,
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

export async function findFormForEvent(db: Db, eventId: string): Promise<FormRow | null> {
  const rows = await db.select().from(schema.form).where(eq(schema.form.eventId, eventId)).limit(1);
  const row = rows[0];
  return row ? toFormRow(row) : null;
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

/** Creates the default CFP form (locked built-ins + empty custom set) for an
 * event that doesn't have one yet, per DEC-008. */
export async function createDefaultForm(db: Db, eventId: string): Promise<{ form: FormRow; fields: FormFieldRow[] }> {
  const now = new Date();
  const formId = newId();
  await db.insert(schema.form).values({
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
  });

  let position = 0;
  const fieldValues: (typeof schema.formField.$inferInsert)[] = [];
  for (const fieldId of LOCKED_SESSION_FIELDS) {
    fieldValues.push({
      id: lockedFieldId(formId, fieldId),
      formId,
      section: "session",
      kind: fieldId === "description" ? "long_text" : "text",
      label: LOCKED_SESSION_LABELS[fieldId] ?? fieldId,
      required: true,
      position: position++,
      locked: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const fieldId of LOCKED_SPEAKER_FIELDS) {
    fieldValues.push({
      id: lockedFieldId(formId, fieldId),
      formId,
      section: "speaker",
      kind: LOCKED_SPEAKER_KIND[fieldId] ?? "text",
      label: LOCKED_SPEAKER_LABELS[fieldId] ?? fieldId,
      required: !OPTIONAL_LOCKED_SPEAKER_FIELDS.has(fieldId),
      position: position++,
      locked: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db.insert(schema.formField).values(fieldValues);

  const form = await findFormForEvent(db, eventId);
  if (!form) throw new Error("form insert did not persist");
  const fields = await listFields(db, formId);
  return { form, fields };
}

/** Reads the event's CFP form + ordered fields, creating the default form on
 * first read if none exists yet (DEC-008). */
export async function getOrCreateForm(db: Db, eventId: string): Promise<{ form: FormRow; fields: FormFieldRow[] }> {
  const existing = await findFormForEvent(db, eventId);
  if (existing) {
    const fields = await listFields(db, existing.id);
    return { form: existing, fields };
  }
  return createDefaultForm(db, eventId);
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
}

export async function patchField(db: Db, fieldId: string, patch: FieldPatch): Promise<FormFieldRow> {
  await db
    .update(schema.formField)
    .set({
      label: patch.label,
      helpText: patch.helpText !== undefined ? patch.helpText : undefined,
      required: patch.required,
      optionsJson: patch.options !== undefined ? (patch.options ? JSON.stringify(patch.options) : null) : undefined,
      ruleJson: patch.rule !== undefined ? (patch.rule ? JSON.stringify(patch.rule) : null) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.formField.id, fieldId));
  const updated = await findFieldById(db, fieldId);
  if (!updated) throw new Error(`field ${fieldId} not found after update`);
  return updated;
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

  const answerRows = await db
    .select({ id: schema.submissionAnswer.id })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.formFieldId, fieldId));

  return { dependentLabels, answerCount: answerRows.length };
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

  const answerRows = await db
    .select({ id: schema.submissionAnswer.id })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.formFieldId, fieldId));
  await db.delete(schema.submissionAnswer).where(eq(schema.submissionAnswer.formFieldId, fieldId));

  await db.delete(schema.formField).where(eq(schema.formField.id, fieldId));

  return { clearedRules: dependents.length, deletedAnswers: answerRows.length };
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
