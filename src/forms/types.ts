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

// DEC-475: a rule's fieldId must be re-keyed exactly like the field's own id
// (lockedFieldName(...) ?? id) — the builder stores rules against the raw
// per-form PK ('<formId>:description'), but answers/visibility checks are
// keyed by the short locked name. Without this normalization, an eq/ne rule
// referencing a locked trigger field silently and permanently evaluates
// against undefined.
export function normalizeRuleFieldId(rule: FormFieldRule): FormFieldRule {
  return { ...rule, fieldId: lockedFieldName(rule.fieldId) ?? rule.fieldId };
}
