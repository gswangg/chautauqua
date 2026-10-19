// The backing form of a form-kind library task (DEC-111). A template item
// such as CFP speakers' "Hotel stay requirement form" names a task of kind
// 'form'; the task needs a real event-scoped form behind it, whose fields
// come from FORM_TASK_FIELD_SPECS (src/domain/acceptance.ts).

import { and, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { FORM_TASK_FIELD_SPECS, type FormTaskFieldSpec } from "../../../domain/acceptance";
import { DEC_111 } from "../../../decisions";

void DEC_111; // form-kind tasks get real backing forms, self-healed when formId is null

// FORM_TASK_FIELD_SPECS is a plain object literal, so a task titled
// `constructor` must not resolve to Object.prototype's function.
export function lookupFormTaskFieldSpecs(title: string): readonly FormTaskFieldSpec[] {
  return Object.prototype.hasOwnProperty.call(FORM_TASK_FIELD_SPECS, title) ? FORM_TASK_FIELD_SPECS[title]! : [];
}

/** Finds or creates the event's form titled exactly `title` (isDefault
 * false and no open/close dates, so it never leaks into the public CFP),
 * seeding its fields only when this call's own insert won the
 * UNIQUE(event_id, title) slot. */
export async function findOrCreateTaskForm(db: Db, eventId: string, title: string, now: Date): Promise<string> {
  const formId = newId();
  await db
    .insert(schema.form)
    .values({ id: formId, eventId, title, isDefault: false, openDate: null, closeDate: null, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: [schema.form.eventId, schema.form.title] });
  // DEC-558: form_event_id_title_idx is a uniqueIndex on (eventId, title),
  // so this predicate already narrows to at most one row
  const winner = await db
    .select({ id: schema.form.id })
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.title, title)))
    .limit(1);
  const row = winner[0];
  if (!row) throw new Error(`findOrCreateTaskForm: no row for (eventId="${eventId}", title="${title}") after insert`);
  if (row.id === formId) {
    for (const [i, spec] of lookupFormTaskFieldSpecs(title).entries()) {
      await db.insert(schema.formField).values({
        id: newId(),
        formId: row.id,
        section: spec.section,
        kind: spec.kind,
        label: spec.label,
        required: spec.required,
        position: i,
        optionsJson: spec.options ? JSON.stringify(spec.options) : null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return row.id;
}
