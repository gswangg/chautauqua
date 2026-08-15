// DEC-592 amendment (wave 10, task w10-a): role-keyed resolution of the two
// well-known CFP fields (session_format, audience_level) via the form_field.
// role column (migrations/0038_form_field_role.sql), as an alternative to
// the global-PK literal ids (SESSION_FORMAT_FIELD_ID / AUDIENCE_LEVEL_
// FIELD_ID in src/forms/types.ts). Those literals still stand this wave --
// no read site is converted here (task w10-b owns that).

import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import type { FormFieldRole } from "../../forms/types";

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
  return row.optionsJson ? (JSON.parse(row.optionsJson) as string[]) : [];
}
