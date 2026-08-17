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

/**
 * The browser's own IANA zone, used as the new-event form's Time zone
 * default. Post-eval polish: the field was `required` with an empty value
 * and only a `placeholder="America/Chicago"` -- ghost text a reader
 * reasonably takes for a filled-in default, so submitting raised the native
 * "Please fill out this field" bubble on a field that looked answered. The
 * form now carries a real, editable value from the first paint. Falls back
 * to 'UTC' if the runtime reports no zone (isValidTimezoneLocal is the
 * gate either way -- an unusable value is never silently kept).
 */
export function defaultTimezone(): string {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return resolved && isValidTimezoneLocal(resolved) ? resolved : 'UTC';
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

export interface ReconcileStoredEventIdResult {
  eventId: string | null;
  changed: boolean;
}

/**
 * DEC-024 amendment (wave 51): the ONE pure decision for "which event am I
 * on" -- is a stored/URL id still valid against the caller's own /events
 * list? If it matches an item, it survives unchanged. If not (previous
 * persona, other org, a deleted event -- or no id at all), it falls back to
 * items[0], and `changed` tells the caller a correction is needed (so the
 * hook knows to persist it). An empty `items` list falls back to `null`
 * with `changed` reflecting whether a non-null id was thrown away -- callers
 * that must fail soft on an empty/failed fetch (never evict a valid stored
 * id on a network blip) guard on `items.length === 0` themselves before
 * applying the result, since this function only decides, it never fetches.
 */
export function reconcileStoredEventId(
  items: EventSwitcherItem[],
  storedId: string | null,
): ReconcileStoredEventIdResult {
  if (storedId) {
    const match = items.find((item) => item.id === storedId);
    if (match) return { eventId: storedId, changed: false };
  }
  const fallback = items[0]?.id ?? null;
  return { eventId: fallback, changed: fallback !== storedId };
}

/** Resolves which event is "current": the id in localStorage if it matches a loaded item, else items[0] (mirrors useCurrentEvent.ts's fallback). */
export function resolveCurrentEvent<T extends EventSwitcherItem>(items: T[], storedId: string | null): T | null {
  const { eventId } = reconcileStoredEventId(items, storedId);
  if (eventId === null) return null;
  return items.find((item) => item.id === eventId) ?? null;
}

/** Merges server field errors (error envelope) onto local validation errors, server taking precedence per field. */
export function mergeFieldErrors(
  local: NewEventFormErrors,
  serverFields: Record<string, string> | undefined,
): NewEventFormErrors {
  if (!serverFields) return local;
  return { ...local, ...serverFields };
}
