// DEC-015 (wave-80 amendment): form.tracks_json's ONE validated parser.
// Before this module, src/server/repo/forms.ts's toFormRow did a bare
// `JSON.parse(row.tracksJson) as string[]` straight onto the admin wire
// (src/routes/api/forms.ts), while the public/portal path went through
// src/lib/submit-core.ts's resolveOfferedTrackIds, which validated
// array-ness and treated an EMPTY array as "all event tracks are offered"
// (DEC-015). Same bytes, opposite meanings: a stored "[]" made the CFP
// builder say "no tracks offered" for a form whose public page offered
// every track, and a non-string member was shipped to the SPA by one reader
// and silently dropped by the other. Modeled closely on the wave-79 sibling
// src/forms/field-json.ts.
//
// Pure core (DEC-002: no node:/cloudflare/drizzle imports).

/** Thrown by parseFormTracks when the stored JSON does not match the shape
 * form.tracks_json is contracted to hold. Names the offending form id so a
 * bad row is loud, not silently coerced. */
export class FormTracksError extends Error {
  constructor(formId: string, detail: string) {
    super(`form ${formId}.tracks_json: ${detail}`);
    this.name = "FormTracksError";
  }
}

/** Parses form.tracks_json. Returns null for null/undefined/"" AND for an
 * empty array -- null is the ONE spelling of "no restriction, offer every
 * event track" (DEC-015). Throws FormTracksError if the JSON does not parse,
 * is not an array, or contains any non-string member. */
export function parseFormTracks(json: string | null | undefined, formId: string): string[] | null {
  if (json === null || json === undefined || json === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new FormTracksError(formId, "not valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string")) {
    throw new FormTracksError(formId, "must be an array of strings");
  }
  if (parsed.length === 0) return null;
  return parsed as string[];
}
