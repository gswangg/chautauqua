// Pure helpers for EventSwitcher (w6-c, DEC-046). Kept framework-free so
// they're unit-testable without rendering.

const SLUG_RE = /^[a-z0-9-]+$/;

/** Client-side mirror of src/routes/api/validators.ts's isValidSlug. */
export function isValidSlugLocal(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/**
 * Client-side mirror of src/routes/api/validators.ts's isValidTimezone:
 * a non-empty IANA timezone string, resolved via Intl (throws on unknown).
 */
export function isValidTimezoneLocal(timezone: string): boolean {
  if (!timezone || timezone.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export interface NewEventForm {
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: string;
}

export interface NewEventFormErrors {
  name?: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  location?: string;
}

/** Client-side pre-validation mirroring the server's field checks (src/routes/api/events.ts POST /events). */
export function validateNewEventForm(form: NewEventForm): NewEventFormErrors {
  const errors: NewEventFormErrors = {};
  if (form.name.trim().length === 0) errors.name = 'Required';
  if (form.slug.trim().length === 0) {
    errors.slug = 'Required';
  } else if (!isValidSlugLocal(form.slug)) {
    errors.slug = 'Must match [a-z0-9-]+';
  }
  if (form.startDate.trim().length === 0) errors.startDate = 'Required';
  if (form.endDate.trim().length === 0) errors.endDate = 'Required';
  if (
    form.startDate.trim().length > 0 &&
    form.endDate.trim().length > 0 &&
    Date.parse(form.startDate) > Date.parse(form.endDate)
  ) {
    errors.endDate = 'Must be on or after startDate';
  }
  if (form.timezone.trim().length === 0) {
    errors.timezone = 'Required';
  } else if (!isValidTimezoneLocal(form.timezone)) {
    errors.timezone = 'Must be a valid IANA timezone';
  }
  return errors;
}

/** Builds the POST /api/v1/events body from the form. */
export function buildNewEventPayload(form: NewEventForm): Record<string, unknown> {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    timezone: form.timezone.trim(),
    location: form.location.trim().length > 0 ? form.location.trim() : undefined,
  };
}

export interface EventSwitcherItem {
  id: string;
  name: string;
}

/** Resolves which event is "current": the id in localStorage if it matches a loaded item, else items[0] (mirrors useCurrentEvent.ts's fallback). */
export function resolveCurrentEvent<T extends EventSwitcherItem>(items: T[], storedId: string | null): T | null {
  if (storedId) {
    const match = items.find((item) => item.id === storedId);
    if (match) return match;
  }
  return items[0] ?? null;
}

/** Merges server field errors (error envelope) onto local validation errors, server taking precedence per field. */
export function mergeFieldErrors(
  local: NewEventFormErrors,
  serverFields: Record<string, string> | undefined,
): NewEventFormErrors {
  if (!serverFields) return local;
  return { ...local, ...serverFields };
}
