import type { AnswerMap, FormFieldDef } from "./types";
import { isVisible } from "./visibility";
import { DEC_124 } from "../decisions";

// Referenced for compile-checked dependency per DEC-124.
void DEC_124;

export const MAX_TEXT_LENGTH = 2000;
export const MAX_LONG_TEXT_LENGTH = 20000;

export type ValidateResult =
  | { ok: true; cleaned: AnswerMap }
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

  const knownIds = new Set(fields.map((f) => f.id));
  for (const key of Object.keys(answers)) {
    if (!knownIds.has(key)) {
      errors[key] = "unknown field";
    }
  }

  for (const field of fields) {
    const visible = isVisible(field, answers);
    const hasAnswer = Object.prototype.hasOwnProperty.call(answers, field.id);
    const value = answers[field.id];

    if (!visible) {
      // Hidden-field answers are stripped from cleaned and never validated.
      continue;
    }

    if (!hasAnswer || value === undefined || value === null || value === "") {
      if (field.required) {
        errors[field.id] = "required";
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
  return { ok: true, cleaned };
}
