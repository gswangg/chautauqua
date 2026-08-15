import { lockedFieldName, type AnswerMap, type FormFieldDef } from "./types";
import { resolveHiddenFieldIds } from "./visibility";
import { isValidEmail, normalizeEmail } from "../domain/email";
import { canonicalizeOperand } from "./rule-match";
import { DEC_124, DEC_454, DEC_455, DEC_681, DEC_718, DEC_842 } from "../decisions";
import { overCapSentence } from "../domain/cap-copy";

// Referenced for compile-checked dependency per DEC-124.
void DEC_124;
// Referenced for compile-checked dependency per DEC-454/DEC-455.
void DEC_454;
void DEC_455;
// Referenced for compile-checked dependency per DEC-842.
void DEC_842;
// Referenced for compile-checked dependency per DEC-718: number answers
// must be finite, and every accepted answer survives a JSON round trip.
void DEC_718;
// Referenced for compile-checked dependency per DEC-681: checkbox answers
// are canonicalized through the ONE shared grammar (canonicalizeOperand),
// never re-implemented here.
void DEC_681;

// DEC-718: the public CFP's <input type="number"> will hand us strings like
// "1e999" (parses to Infinity), "0x1f" (silently reinterpreted by Number()
// as 31), "1_000", or a bare "." — none of those are a "decimal number".
// This is the ONE grammar a string answer must match before we even call
// Number() on it: optional sign, digits, optional fractional part, optional
// decimal exponent. Anchored so nothing can hide before/after a valid core.
export const NUMBER_FIELD_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

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
        // DEC-124 (wave 59 amendment): a field's own `maximum` (stamped by
        // projectFieldForAnswers, e.g. the locked abstract field's 1,200
        // budget) may only NARROW the shared kind cap, never widen it.
        const kindCap = field.kind === "text" ? MAX_TEXT_LENGTH : MAX_LONG_TEXT_LENGTH;
        const cap = field.maximum !== undefined ? Math.min(field.maximum, kindCap) : kindCap;
        if (value.length > cap) {
          // DEC-422 (amendment): the rich refusal (what was typed, how far
          // over, the limit) is emitted HERE, at the source, instead of a
          // terse "Too long (max N characters)" that a downstream caller
          // (the public CFP) used to re-parse via a regex matching this
          // exact prose -- see submit-messages.ts's deleted
          // overLengthErrorMessage for the history.
          errors[field.id] = overCapSentence(field.label, value.length, cap);
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
        const boolValue = canonicalizeOperand("checkbox", value);
        if (boolValue === undefined) {
          errors[field.id] = "must be true or false";
          continue;
        }
        if (field.required && boolValue !== true) {
          errors[field.id] = "required";
          continue;
        }
        cleaned[field.id] = boolValue;
        break;
      }
      case "number": {
        // DEC-718: a string answer must match the decimal grammar before
        // Number() ever sees it (rejects "0x1f", "1_000", "Infinity",
        // "NaN", bare "."), and the parsed/typed result must be finite
        // (rejects "1e999", which the grammar accepts but which parses to
        // Infinity — a required field must not silently become null).
        let num: number;
        if (typeof value === "number") {
          num = value;
        } else if (typeof value === "string" && NUMBER_FIELD_PATTERN.test(value)) {
          num = Number(value);
        } else {
          errors[field.id] = "must be a number";
          continue;
        }
        if (!Number.isFinite(num)) {
          errors[field.id] = "must be a number";
          continue;
        }
        // Normalize -0 to 0: JSON.stringify(-0) is "0", so the sign would
        // otherwise silently flip on the very next round-trip through the
        // store — normalize here so `cleaned` already matches what gets
        // persisted and read back.
        cleaned[field.id] = num === 0 ? 0 : num;
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
