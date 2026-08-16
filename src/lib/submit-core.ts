// Pure logic backing the public CFP submit flow (src/routes/public/submit.tsx,
// src/server/repo/submit.ts): closed-date gate (CFP-04), track-choice
// validation, and seq-ref formatting (DEC-003). Rate limiting for public
// submit lives in src/lib/rate-limit.ts's checkAndIncrementScopedLimit
// (DEC-057). Web APIs only (DEC-002) — no node:/cloudflare/drizzle imports.

import { formatRef, MAX_SUBMISSION_TRACK_IDS } from "../domain/ids";
import { overCapCountMessage } from "../domain/cap-copy";
import { dayLabelEndInstant, dayLabelStartInstant } from "./timezone";
import { parseFormTracks } from "../forms/form-tracks";

/** CFP-04 / DEC-522: past form.close_date rejects new submissions. A
 * null/undefined close date means the form never closes. closeDate is a DAY
 * LABEL (UTC midnight of the intended calendar day), not an instant — it is
 * expanded to the event-local end-of-day instant (dayLabelEndInstant) before
 * comparison, so a form set to close on 2027-03-01 in America/Los_Angeles
 * actually closes at the end of March 1st local time, not at UTC midnight. */
export function isFormClosed(
  closeDate: number | null | undefined,
  now: number,
  timeZone: string,
): boolean {
  if (closeDate === null || closeDate === undefined) return false;
  return now > dayLabelEndInstant(closeDate, timeZone);
}

export type FormWindowState = "not_yet_open" | "open" | "closed";

/** DEC-036/DEC-522: canonical form-window gate. A null/undefined open date
 * means the form is open immediately; a null/undefined close date means it
 * never closes. openDate/closeDate are DAY LABELS, expanded to event-local
 * start-of-day / end-of-day instants respectively. Boundaries match
 * isFormClosed's inclusive-at-the-instant rule: exactly at the local start
 * of openDate the form is open, exactly at the local end of closeDate it's
 * still open (closes strictly after). */
export function formWindowState(
  openDate: number | null | undefined,
  closeDate: number | null | undefined,
  now: number,
  timeZone: string,
): FormWindowState {
  if (openDate !== null && openDate !== undefined && now < dayLabelStartInstant(openDate, timeZone)) {
    return "not_yet_open";
  }
  if (isFormClosed(closeDate, now, timeZone)) {
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
 * either.
 *
 * DEC-598 (wave-10 amendment): trackIds are a SET at every boundary — the
 * count cap (MAX_SUBMISSION_TRACK_IDS) is enforced here too, so the
 * anonymous public CFP and the portal edit share the ONE cap from the ONE
 * place, in the shared cap-copy grammar (never a bare number). The
 * unknown-track membership check still runs first and wins over the cap. */
export function validateTrackChoice(
  selectedTrackIds: string[],
  availableTrackIds: string[],
): TrackChoiceResult {
  const available = new Set(availableTrackIds);
  const hasUnknown = selectedTrackIds.some((id) => !available.has(id));
  if (hasUnknown) {
    return { ok: false, error: "Selected track is not offered by this form." };
  }
  if (selectedTrackIds.length > MAX_SUBMISSION_TRACK_IDS) {
    return { ok: false, error: overCapCountMessage(selectedTrackIds.length, MAX_SUBMISSION_TRACK_IDS, "track") };
  }
  if (availableTrackIds.length === 0) {
    return { ok: true };
  }
  if (selectedTrackIds.length === 0) {
    // DEC-986 (wave 40 amendment): the public CFP picks ONE track via a
    // radio group, so "at least one" reads oddly there -- "Select a track"
    // is the shared copy for both the single-choice public form and the
    // multi-select portal edit checkbox group.
    return { ok: false, error: "Select a track" };
  }
  return { ok: true };
}

/** Resolves the offered track ids for a form: form.tracks_json (parsed via
 * the ONE validated parseFormTracks, DEC-015 wave-80 amendment) when
 * present and non-empty, else every event track id (DEC-015). */
export function resolveOfferedTrackIds(
  tracksJson: string | null | undefined,
  eventTrackIds: string[],
  formId: string,
): string[] {
  return parseFormTracks(tracksJson, formId) ?? eventTrackIds;
}

/** DEC-003 display ref for the next submission in an event. Seq allocation
 * itself is INSERT-select COALESCE(MAX(seq),0)+1 (repo layer, needs the DB);
 * this formats the ref from that allocated seq. */
export function nextSeqRef(recordPrefix: string, currentMaxSeq: number): string {
  return formatRef(recordPrefix, currentMaxSeq + 1);
}

/** DEC-986 (wave 45 amendment): the public CFP asks for ONE "Name" control;
 * the two locked speaker fields (first_name/last_name) still exist as real
 * columns underneath (DEC-016), so the submitted string is split here before
 * validateAnswers ever runs. Split on the LAST run of whitespace: everything
 * before it is first_name, the remainder last_name. A single-token name (no
 * whitespace) puts the whole string in first_name and leaves last_name empty
 * — never rejected, since last_name carries no required-ness of its own
 * (the single control is what's required). The input is NOT trimmed of
 * interior formatting beyond this split; callers trim the two halves
 * themselves via the normal text-field validation path. */
export function splitSubmittedName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const match = /^(.*)\s+(\S+)$/.exec(trimmed);
  if (!match) return { firstName: trimmed, lastName: "" };
  return { firstName: match[1] ?? "", lastName: match[2] ?? "" };
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
