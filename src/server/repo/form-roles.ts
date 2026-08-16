// DEC-592/DEC-755: the ONE role-keyed resolver every read site uses for the
// two well-known CFP fields (session_format, audience_level), via the
// form_field.role column (migrations/0038_form_field_role.sql). Replaces the
// retired global-PK literal ids that used to be hardcoded in src/forms/types.ts
// -- role is the sole matcher now, everywhere a caller needs the event's
// format or audience-level field.

import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import type { FormFieldRole } from "../../forms/types";
import { parseFieldOptions } from "../../forms/field-json";

/** A SQL condition, usable in a submission_answer WHERE clause, selecting
 * only rows whose form_field carries the given role. Parameterised via
 * drizzle's `sql` tag -- never string-concatenated. */
export function answerFieldRoleCondition(role: FormFieldRole): SQL {
  return sql`EXISTS (SELECT 1 FROM ${schema.formField} WHERE ${schema.formField.id} = ${schema.submissionAnswer.formFieldId} AND ${schema.formField.role} = ${role})`;
}

/** The event's default form's field id carrying `role`, or null if no such
 * field exists on that form. */
export async function getEventFieldIdByRole(db: Db, eventId: string, role: FormFieldRole): Promise<string | null> {
  const rows = await db
    .select({ id: schema.formField.id })
    .from(schema.formField)
    .innerJoin(schema.form, eq(schema.form.id, schema.formField.formId))
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true), eq(schema.formField.role, role)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** DEC-592 (Amendment, wave 80): the ONE resolver for a role-tagged
 * submission_answer's stored value -- session_format and audience_level are
 * both single-select dropdown answers whose value_json is either a JSON
 * string (the chosen option's label) or one of the "no real answer"
 * shapes: '""' (stored empty string), 'null', a number, an array, or an
 * object. A non-empty JSON string is the label; every other shape is null.
 *
 * Deliberately NOT src/domain/answer-text.ts's grammar (DEC-561): that
 * module renders an arbitrary CFP custom-answer for display or export
 * (joins arrays, renders booleans as Yes/No or true/false). A role answer
 * is never a list, never a boolean rendered as text -- it is a stored
 * label or nothing. The two resolvers must never be conflated into one. */
export function roleAnswerLabel(valueJson: string): string | null {
  const parsed: unknown = JSON.parse(valueJson);
  return typeof parsed === "string" && parsed.length > 0 ? parsed : null;
}

/** Batched form of roleAnswerLabel, keyed by submissionId -- the shared
 * shape every caller (overview, review queue, scorecard, public sessions,
 * portal submissions/data, agenda rows) collects role-tagged answer rows
 * into. */
export function roleAnswerMap(rows: readonly { submissionId: string; valueJson: string }[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const row of rows) {
    map.set(row.submissionId, roleAnswerLabel(row.valueJson));
  }
  return map;
}

/** The role-tagged field's dropdown options on the event's default form.
 * Null when the event's form has no field of that role; `[]` when it has
 * one with no options defined. */
export async function getFieldOptionsByRole(db: Db, eventId: string, role: FormFieldRole): Promise<string[] | null> {
  const rows = await db
    .select({ optionsJson: schema.formField.optionsJson })
    .from(schema.formField)
    .innerJoin(schema.form, eq(schema.form.id, schema.formField.formId))
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true), eq(schema.formField.role, role)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // This reader's contract distinguishes "no field of that role" (null,
  // above) from "field exists but has no options" ([]) -- the empty-array
  // answer stays visible here at the call site rather than being baked into
  // a second parser alongside parseFieldOptions' shared `undefined` answer.
  return parseFieldOptions(row.optionsJson, `role:${role}`) ?? [];
}
