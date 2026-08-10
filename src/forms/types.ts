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
export const LOCKED_SPEAKER_FIELDS = ["first_name", "last_name", "email"] as const;
