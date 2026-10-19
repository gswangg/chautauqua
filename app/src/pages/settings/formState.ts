// Pure form-state helpers for the w4-h Settings panels (DEC-032). Kept
// framework-free so they're unit-testable without rendering: each panel
// diffs its local form state against the last-loaded record and only sends
// changed fields on save (mirrors the server's partial-update contracts).

// DEC-371 amendment (wave 43): the hex-colour grammar lives ONE place,
// src/domain/color.ts — imported here (app/tsconfig.json includes
// ../src/domain/**/*.ts) rather than re-implemented as a local regex.
import { isValidHexColor } from "../../../../src/domain/color";

export interface EventSettingsForm {
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string;
  timezone: string;
  recordPrefix: string;
  logoUrl: string;
  accentColor: string;
}

/** Builds a PATCH /api/v1/events/:id body containing only fields that changed vs `initial`. */
export function buildEventPatch(
  initial: EventSettingsForm,
  current: EventSettingsForm,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (current.name !== initial.name) patch.name = current.name;
  if (current.slug !== initial.slug) patch.slug = current.slug;
  if (current.startDate !== initial.startDate) patch.startDate = current.startDate;
  if (current.endDate !== initial.endDate) patch.endDate = current.endDate;
  if (current.location !== initial.location) patch.location = current.location || null;
  if (current.timezone !== initial.timezone) patch.timezone = current.timezone;
  // recordPrefix is display-only in this panel today: the events API has no
  // recordPrefix field in its PATCH contract (it's set at creation), so it
  // is intentionally never included in the patch.
  if (current.logoUrl !== initial.logoUrl || current.accentColor !== initial.accentColor) {
    patch.branding = {
      logoUrl: current.logoUrl || null,
      accentColor: current.accentColor || null,
    };
  }
  return patch;
}

/** Client-side use of the server's grammar (src/domain/color.ts) — empty is allowed (clears the field). */
export function isValidHexColorOrEmpty(value: string): boolean {
  return value.trim().length === 0 || isValidHexColor(value);
}

export interface TrackForm {
  name: string;
  color: string;
}

// DEC-856 (wave 65 amendment): the client validator only ever produces
// name/color, but the server's fields map (src/routes/api/events.ts:416-536,
// "Invalid track") can in principle name any wire key -- the index
// signature lets a caller merge `err.fields` in directly and render any key
// it doesn't own as a labelled "<key>: <message>" line rather than drop it.
export interface TrackFormErrors {
  name?: string;
  color?: string;
  [key: string]: string | undefined;
}

export function validateTrackForm(form: TrackForm): TrackFormErrors {
  const errors: TrackFormErrors = {};
  if (form.name.trim().length === 0) errors.name = "Required";
  if (!isValidHexColorOrEmpty(form.color)) errors.color = "Must be a hex color like #336699";
  return errors;
}

export interface RoomForm {
  name: string;
  capacity: string;
}

// DEC-856 (wave 65 amendment): same rationale as TrackFormErrors -- the
// server's "Invalid room" fields map (src/routes/api/events.ts, ApiError
// "Invalid room" fields) is merged in directly, so an index signature is
// needed for any key this panel doesn't name below.
export interface RoomFormErrors {
  name?: string;
  capacity?: string;
  [key: string]: string | undefined;
}

export function validateRoomForm(form: RoomForm): RoomFormErrors {
  const errors: RoomFormErrors = {};
  if (form.name.trim().length === 0) errors.name = "Required";
  if (form.capacity.trim().length > 0) {
    const n = Number(form.capacity);
    if (!Number.isInteger(n) || n < 0) errors.capacity = "Must be a non-negative integer";
  }
  return errors;
}
