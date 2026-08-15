// DEC-561 (Amendment, wave 60): the ONE module that renders an arbitrary
// CFP custom-answer value (session or speaker side) as text. Two grammars,
// each named once: `answerDisplayText` for screen rendering (', '-joined
// lists, 'Yes'/'No' booleans, a caller-declared empty token) and
// `answerExportCell` for machine export (this file's declared list grammar
// for tracks/speakers/emails: '; '-joined, 'true'/'false' booleans). Both
// render a non-array object as JSON.stringify — NEVER the useless
// '[object Object]' that String(value) produces on a plain object.
// Pure core: no node:/cf imports, stays unit-testable without a DOM.
import { DEC_561 } from "../decisions";

void DEC_561;

/** Render one CFP answer value for a human-facing screen. */
export function answerDisplayText(value: unknown, opts?: { empty?: string }): string {
  const empty = opts?.empty ?? "";
  if (value === null || value === undefined || value === "") return empty;
  if (Array.isArray(value)) return value.map((v) => answerDisplayText(v)).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") return String(value);
  return JSON.stringify(value);
}

/** Render one CFP answer value for a machine export cell (CSV/JSON). */
export function answerExportCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => answerExportCell(v)).join("; ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" || typeof value === "string") return String(value);
  return JSON.stringify(value);
}
