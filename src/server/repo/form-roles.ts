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
