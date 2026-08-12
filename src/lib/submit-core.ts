// Pure logic backing the public CFP submit flow (src/routes/public/submit.tsx,
// src/server/repo/submit.ts): closed-date gate (CFP-04), track-choice
// validation, and seq-ref formatting (DEC-003). Rate limiting for public
// submit lives in src/lib/rate-limit.ts's checkAndIncrementScopedLimit
// (DEC-057). Web APIs only (DEC-002) — no node:/cloudflare/drizzle imports.

import { formatRef } from "../domain/ids";

/** CFP-04: past form.close_date rejects new submissions. A null/undefined
 * close date means the form never closes. */
export function isFormClosed(closeDate: number | null | undefined, now: number): boolean {
  if (closeDate === null || closeDate === undefined) return false;
  return now > closeDate;
}

export type FormWindowState = "not_yet_open" | "open" | "closed";

/** DEC-036: canonical form-window gate. A null/undefined open date means the
 * form is open immediately; a null/undefined close date means it never
 * closes. Boundaries match isFormClosed's inclusive-at-the-instant rule:
 * exactly at openDate the form is open, exactly at closeDate it's still
 * open (closes strictly after). */
export function formWindowState(
  openDate: number | null | undefined,
  closeDate: number | null | undefined,
  now: number,
): FormWindowState {
  if (openDate !== null && openDate !== undefined && now < openDate) {
    return "not_yet_open";
  }
  if (isFormClosed(closeDate, now)) {
    return "closed";
  }
  return "open";
}

export type TrackChoiceResult = { ok: true } | { ok: false; error: string };

/** At least one track must be chosen, and only from the set actually
 * offered by the form (DEC-015 form.tracks_json / all event tracks).
 * DEC-416: the membership check runs FIRST and unconditionally — including
 * when availableTrackIds is empty — so a submitter can never smuggle in a
 * foreign/other-org track id just because the form happens to offer none.
 * Only after that check clears does DEC-301 apply: a form that offers zero
 * tracks cannot require one — every new event ships a default 'General'
 * track, so a truly empty availableTrackIds only happens if a producer
 * deletes every track, and submissions must not dead-end in that case
 * either. */
export function validateTrackChoice(
  selectedTrackIds: string[],
  availableTrackIds: string[],
): TrackChoiceResult {
  const available = new Set(availableTrackIds);
  const hasUnknown = selectedTrackIds.some((id) => !available.has(id));
  if (hasUnknown) {
    return { ok: false, error: "Selected track is not offered by this form." };
  }
  if (availableTrackIds.length === 0) {
    return { ok: true };
  }
  if (selectedTrackIds.length === 0) {
    return { ok: false, error: "Select at least one track." };
  }
  return { ok: true };
}

/** Resolves the offered track ids for a form: form.tracks_json (parsed)
 * when present and non-empty, else every event track id (DEC-015). */
export function resolveOfferedTrackIds(
  tracksJson: string | null | undefined,
  eventTrackIds: string[],
): string[] {
  if (!tracksJson) return eventTrackIds;
  const parsed = JSON.parse(tracksJson) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) return eventTrackIds;
  return parsed.filter((v): v is string => typeof v === "string");
}

/** DEC-003 display ref for the next submission in an event. Seq allocation
 * itself is INSERT-select COALESCE(MAX(seq),0)+1 (repo layer, needs the DB);
 * this formats the ref from that allocated seq. */
export function nextSeqRef(recordPrefix: string, currentMaxSeq: number): string {
  return formatRef(recordPrefix, currentMaxSeq + 1);
}

/** DEC-040: pulls each file-kind field's uploaded File out of a parsed
 * multipart body. `fieldNameOf` maps a field id to its form input name
 * (kept as a caller-supplied callback rather than importing the view layer,
 * per the pure-core import direction). A field with nothing selected, or a
 * browser's empty-file placeholder (no filename / zero bytes), is simply
 * absent from the result — same "no answer" case forms/validate.ts already
 * handles for every other field kind. */
export function extractFileAnswers(
  fileFieldIds: string[],
  fieldNameOf: (fieldId: string) => string,
  body: Record<string, unknown>,
): Record<string, File> {
  const out: Record<string, File> = {};
  for (const fieldId of fileFieldIds) {
    const raw = body[fieldNameOf(fieldId)];
    if (raw instanceof File && raw.size > 0 && raw.name !== "") {
      out[fieldId] = raw;
    }
  }
  return out;
}
