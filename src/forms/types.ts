// Form engine field model — per DEC-008. Pure types only, no runtime deps
// beyond plain TS/JS (DEC-002: no node:/cloudflare/drizzle imports).

// DEC-615 (wave 73): declared once as `as const` arrays so both sides
// (server pure core and the SPA) derive their types from the same runtime
// vocabulary, mirroring FORM_FIELD_ROLES/FormFieldRole below.
export const FORM_FIELD_SECTIONS = ["session", "speaker"] as const;
export type FormFieldSection = (typeof FORM_FIELD_SECTIONS)[number];

export const FORM_FIELD_KINDS = [
  "text",
  "long_text",
  "dropdown",
  "checkbox",
  "number",
  "file",
] as const;
export type FormFieldKind = (typeof FORM_FIELD_KINDS)[number];

export const FORM_FIELD_RULE_OPS = ["eq", "ne", "in"] as const;
export type FormFieldRuleOp = (typeof FORM_FIELD_RULE_OPS)[number];

// DEC-592/DEC-755 (wave 10, task w10-b): the role tag a form_field row can
// carry so the two well-known CFP fields (session format, audience level)
// are resolved by role via src/server/repo/form-roles.ts, not a global-PK
// literal id. The retired global-PK literal ids have been deleted -- role
// is the ONE matcher.
export const FORM_FIELD_ROLES = ["session_format", "audience_level"] as const;
export type FormFieldRole = (typeof FORM_FIELD_ROLES)[number];

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
  // DEC-592 amendment (wave 10): role tag, when this field is one of the
  // two well-known CFP fields. Absent/null on ordinary custom fields.
  role?: FormFieldRole | null;
  // DEC-909: a long-text field's own character budget, when it carries one.
  // Absent means the renderer's counter AND src/forms/validate.ts's cap fall
  // back to the shared MAX_LONG_TEXT_LENGTH/MAX_TEXT_LENGTH. When present
  // this is an ENFORCED narrowing, not a display hint -- validate.ts's
  // text/long_text branch takes `Math.min(field.maximum, kindCap)`, so a
  // field.maximum can only tighten the shared kind cap, never widen it.
  // projectFieldForAnswers (DEC-124 amendment, wave 59) is the one place
  // that stamps the locked abstract field's maximum.
  maximum?: number;
}

// DEC-124 (wave 59 amendment): the locked abstract (description) field's
// character budget, both displayed ("N / 1,200" counter) and enforced
// server-side via projectFieldForAnswers below.
export const LOCKED_ABSTRACT_MAX_LENGTH = 1200;

// DEC-124 (wave 61 amendment): same kind of constant as
// LOCKED_ABSTRACT_MAX_LENGTH above -- the locked title field's character
// budget, enforced server-side via projectFieldForAnswers below and declared
// by every writer of a locked session title (routes + SPA inline edit form).
export const LOCKED_TITLE_MAX_LENGTH = 200;

// DEC-417 (wave 67 amendment): the locked contact-identity fields
// (first_name/last_name/job_title/company) mint contact rows, and the CRM's
// own writers (src/routes/api/contacts/crud.ts, portal/profile.tsx,
// portal-edit.ts's addCoPresenter) cap those same columns at
// src/forms/validate.ts's MAX_NAME_LENGTH (200). This constant is that
// number's twin on the forms side, enforced server-side via
// projectFieldForAnswers below. Kept as a separate literal rather than an
// import of validate.ts to avoid a cycle (validate.ts already imports this
// module); test/contact-identity-cap-parity.test.ts pins the two values
// equal so they can't drift apart.
export const LOCKED_CONTACT_TEXT_MAX_LENGTH = 200;

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
  const name = lockedFieldName(def.id);
  return {
    ...def,
    id: name ?? def.id,
    ...(def.rule
      ? { rule: { ...def.rule, fieldId: lockedFieldName(def.rule.fieldId) ?? def.rule.fieldId } }
      : {}),
    ...(name === "description" ? { maximum: def.maximum ?? LOCKED_ABSTRACT_MAX_LENGTH } : {}),
    ...(name === "title" ? { maximum: def.maximum ?? LOCKED_TITLE_MAX_LENGTH } : {}),
    ...(name === "first_name" ||
    name === "last_name" ||
    name === "job_title" ||
    name === "company"
      ? { maximum: def.maximum ?? LOCKED_CONTACT_TEXT_MAX_LENGTH }
      : {}),
  };
}
