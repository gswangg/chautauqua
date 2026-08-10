// Pure form-state helpers for the w4-h Settings panels (DEC-032). Kept
// framework-free so they're unit-testable without rendering: each panel
// diffs its local form state against the last-loaded record and only sends
// changed fields on save (mirrors the server's partial-update contracts).

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

export interface PortalSettingsForm {
  logoUrl: string;
  accentColor: string;
  welcomeMessage: string;
  showResources: boolean;
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Client-side mirror of the server's isValidHexColor (src/routes/api/validators.ts) — empty is allowed (clears the field). */
export function isValidHexColorOrEmpty(value: string): boolean {
  return value.trim().length === 0 || HEX_COLOR_RE.test(value);
}

export interface PortalSettingsFormErrors {
  accentColor?: string;
}

export function validatePortalSettingsForm(form: PortalSettingsForm): PortalSettingsFormErrors {
  const errors: PortalSettingsFormErrors = {};
  if (!isValidHexColorOrEmpty(form.accentColor)) {
    errors.accentColor = "Must be a hex color like #336699";
  }
  return errors;
}

/** Builds the PUT /api/v1/events/:id/portal-settings body (full upsert, not a diff — the endpoint is idempotent). */
export function buildPortalSettingsPayload(form: PortalSettingsForm): Record<string, unknown> {
  return {
    logoUrl: form.logoUrl.trim().length > 0 ? form.logoUrl : null,
    accentColor: form.accentColor.trim().length > 0 ? form.accentColor : null,
    welcomeMessage: form.welcomeMessage.trim().length > 0 ? form.welcomeMessage : null,
    showResources: form.showResources,
  };
}

export interface ResourceForm {
  title: string;
  content: string;
}

export interface ResourceFormErrors {
  title?: string;
  content?: string;
}

export function validateResourceForm(form: ResourceForm): ResourceFormErrors {
  const errors: ResourceFormErrors = {};
  if (form.title.trim().length === 0) errors.title = "Required";
  if (form.content.trim().length === 0) errors.content = "Required";
  return errors;
}

export interface TrackForm {
  name: string;
  color: string;
}

export interface TrackFormErrors {
  name?: string;
  color?: string;
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

export interface RoomFormErrors {
  name?: string;
  capacity?: string;
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
