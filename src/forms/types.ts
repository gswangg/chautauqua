// Form engine field model — per DEC-008. Pure types only, no runtime deps
// beyond plain TS/JS (DEC-002: no node:/cloudflare/drizzle imports).

export type FormFieldSection = "session" | "speaker";

export type FormFieldKind =
  | "text"
  | "long_text"
  | "dropdown"
  | "checkbox"
  | "number"
  | "file";

export type FormFieldRuleOp = "eq" | "ne" | "in";

export interface FormFieldRule {
  fieldId: string;
  op: FormFieldRuleOp;
  value: unknown;
}

export interface FormFieldDef {
  id: string;
  section: FormFieldSection;
  kind: FormFieldKind;
  label: string;
  helpText?: string;
  required: boolean;
  position: number;
  options?: string[];
  rule?: FormFieldRule;
  // DEC-909: a long-text field's own character budget, when it carries one.
  // Absent means the renderer's counter falls back to the shared
  // MAX_LONG_TEXT_LENGTH (src/forms/validate.ts) -- no field defines its own
  // today, so this is currently always undefined, but the hook is named so
  // a future per-field cap doesn't require a second grammar.
  maximum?: number;
}

// Answers keyed by fieldId. Values are unvalidated/untrusted input until
// passed through validateAnswers.
export type AnswerMap = Record<string, unknown>;

// DEC-008 locked built-in fields: non-removable, always required, always
// present in the builder UI. These are field ids, not full FormFieldDef
// objects — the builder is responsible for rendering/positioning them.
export const LOCKED_SESSION_FIELDS = ["title", "description"] as const;
// DEC-321: job_title/company/bio appended so the default CFP collects a
// public-speakers-list-worthy profile. Append-only — existing code that
// indexes [0]/[1]/[2] (first_name/last_name/email) keeps working.
export const LOCKED_SPEAKER_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "job_title",
  "company",
  "bio",
] as const;

const ALL_LOCKED_NAMES = new Set<string>([...LOCKED_SESSION_FIELDS, ...LOCKED_SPEAKER_FIELDS]);

// DEC-592: the ONE id for the "Session format" custom field the seed and
// public-surface hydration both key on (submission_answer.form_field_id).
// Not a locked field (organizers may rename/remove it) — but its id is a
// named constant, not a hand-copied literal, so seed and repo code can't
// drift apart on the string.
export const SESSION_FORMAT_FIELD_ID = "field_session_format";

// DEC-050: locked form_field rows get a per-form PK (`${formId}:${name}`)
// so a second event's default form doesn't collide with the first event's
// (formField.id is a global PK). lockedFieldId mints that PK for new rows;
// lockedFieldName is the ONLY test for "is this row/answer-key a locked
// built-in, and what's its short name" — it strips everything through the
// first ':' and checks the remainder against the locked name sets. An
// unprefixed id (no ':') is checked as-is, so pre-existing seeded rows
// ('title', 'first_name', ...) still resolve without a data migration.
export function lockedFieldId(formId: string, name: string): string {
  return `${formId}:${name}`;
}

export function lockedFieldName(id: string): string | null {
  const idx = id.indexOf(":");
  const name = idx === -1 ? id : id.slice(idx + 1);
  return ALL_LOCKED_NAMES.has(name) ? name : null;
}

// DEC-475/DEC-486: a field's own id AND its rule's fieldId are both
// references into the same answer map, and must be re-keyed identically
// (lockedFieldName(...) ?? id) — the builder stores locked rows and rule
// references against the raw per-form PK ('<formId>:description'), but
// answers/visibility checks are keyed by the short locked name. Doing this
// normalization in two separate call sites let them drift (a rule keyed on
// a locked trigger field silently and permanently evaluated against
// undefined); projectFieldForAnswers is the ONE projection — id and
// rule.fieldId normalized in the same expression so they can never diverge
// again. Callers must build the FormFieldDef with RAW ids/rule.fieldId and
// pass it through this function, never call lockedFieldName inline on id.
export function projectFieldForAnswers(def: FormFieldDef): FormFieldDef {
  return {
    ...def,
    id: lockedFieldName(def.id) ?? def.id,
    ...(def.rule
      ? { rule: { ...def.rule, fieldId: lockedFieldName(def.rule.fieldId) ?? def.rule.fieldId } }
      : {}),
  };
}
