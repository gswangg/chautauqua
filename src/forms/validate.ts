import { lockedFieldName, type AnswerMap, type FormFieldDef } from "./types";
import { resolveHiddenFieldIds } from "./visibility";
import { isValidEmail, normalizeEmail } from "../domain/email";
import { DEC_124, DEC_454, DEC_455, DEC_842 } from "../decisions";

// Referenced for compile-checked dependency per DEC-124.
void DEC_124;
// Referenced for compile-checked dependency per DEC-454/DEC-455.
void DEC_454;
void DEC_455;
// Referenced for compile-checked dependency per DEC-842.
void DEC_842;

export const MAX_TEXT_LENGTH = 2000;
export const MAX_LONG_TEXT_LENGTH = 20000;
// DEC-417
export const MAX_NAME_LENGTH = 200;
export const MAX_RICH_TEXT_LENGTH = 100000;

export type ValidateResult =
  | { ok: true; cleaned: AnswerMap; hiddenFieldIds: string[]; clearedFieldIds: string[] }
  | { ok: false; errors: Record<string, string> };

// Server-side validation of submitted answers against a form's field defs.
// Never trusts client rendering (DEC-008): visibility is recomputed here,
// required is enforced only for currently-visible fields, hidden-field
// answers are stripped, and unknown answer keys are rejected. Returns a
// structured result — user input errors are expected external input, not
// exceptions.
export function validateAnswers(
  fields: FormFieldDef[],
  answers: AnswerMap,
): ValidateResult {
  const errors: Record<string, string> = {};
  const cleaned: AnswerMap = {};
  const hiddenFieldIds: string[] = [];
  const clearedFieldIds: string[] = [];

  const knownIds = new Set(fields.map((f) => f.id));
  for (const key of Object.keys(answers)) {
    if (!knownIds.has(key)) {
      errors[key] = "unknown field";
    }
  }

  const hidden = resolveHiddenFieldIds(fields, answers);

  for (const field of fields) {
    const visible = !hidden.has(field.id);
    const hasAnswer = Object.prototype.hasOwnProperty.call(answers, field.id);
    const value = answers[field.id];

    if (!visible) {
      // Hidden-field answers are stripped from cleaned and never validated.
      // DEC-501: record hidden field ids so the caller can delete stale
      // answers, not just omit them from this save's upsert.
      hiddenFieldIds.push(field.id);
      continue;
    }

    // DEC-455: a string whose trim is empty is ABSENT, not just "".
    const isBlankString = typeof value === "string" && value.trim() === "";
    if (!hasAnswer || value === undefined || value === null || value === "" || isBlankString) {
      if (field.required) {
        errors[field.id] = "required";
      } else if (hasAnswer && (value === "" || isBlankString)) {
        // DEC-842: a submitted blank on a visible, non-required field is an
        // instruction to CLEAR the stored value. Absence (key not present,
        // or null/undefined) must stay distinguishable from clearing.
        clearedFieldIds.push(field.id);
      }
      continue;
    }

    switch (field.kind) {
      case "text":
      case "long_text": {
        if (typeof value !== "string") {
          errors[field.id] = "must be a string";
          continue;
        }
        const cap = field.kind === "text" ? MAX_TEXT_LENGTH : MAX_LONG_TEXT_LENGTH;
        if (value.length > cap) {
          errors[field.id] = `Too long (max ${cap} characters)`;
          continue;
        }
        // DEC-454: the locked email field is validated/normalized here so
        // every path through validateAnswers (public CFP, admin edits)
        // enforces the same canonical email rule.
        if (field.kind === "text" && lockedFieldName(field.id) === "email") {
          if (!isValidEmail(value)) {
            errors[field.id] = "must be a valid email address";
            continue;
          }
          cleaned[field.id] = normalizeEmail(value);
          break;
        }
        cleaned[field.id] = value;
        break;
      }
      case "dropdown": {
        if (typeof value !== "string" || !(field.options ?? []).includes(value)) {
          errors[field.id] = "invalid option";
          continue;
        }
        cleaned[field.id] = value;
        break;
      }
      case "checkbox": {
        const boolValue = Boolean(value);
        if (field.required && boolValue !== true) {
          errors[field.id] = "required";
          continue;
        }
        cleaned[field.id] = boolValue;
        break;
      }
      case "number": {
        const num = typeof value === "number" ? value : Number(value);
        if (typeof value === "boolean" || Array.isArray(value) || Number.isNaN(num)) {
          errors[field.id] = "must be a number";
          continue;
        }
        cleaned[field.id] = num;
        break;
      }
      case "file": {
        // File uploads are handled elsewhere; the answer is an opaque
        // file-id string referencing an already-uploaded file.
        if (typeof value !== "string" || value.length === 0) {
          errors[field.id] = "invalid file";
          continue;
        }
        cleaned[field.id] = value;
        break;
      }
      default: {
        const exhaustive: never = field.kind;
        throw new Error(`unknown field kind: ${exhaustive}`);
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, cleaned, hiddenFieldIds, clearedFieldIds };
}
