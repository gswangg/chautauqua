// v12 mobile campaign w5 (DEC-621 wave-87 amendment): the Comms phone
// landing's "Draft in progress" card (frame docs/design/Chautauqua
// Comms.dc.html:188-193) was wired with a permanent `draft={null}` because
// nothing in the app ever recorded an in-progress compose draft anywhere --
// see docs/design/audit/comms-v12.md finding 1. This module is that
// record's one producer/consumer contract: ONE localStorage key per event,
// written by ComposeWizard on each step advance (never on keystroke -- see
// its call site) and read by CommsPage on mount.
//
// DEC-967's wave-54 amendment bans a silent, invisible pre-fill of form
// state the visitor didn't act to create. Writing on step advance (an
// explicit "Next" press) rather than on every keystroke keeps this on the
// right side of that line -- the record only ever reflects a step the
// organizer has actually completed, not their still-being-typed subject
// line.
//
// Fail loudly (house rule): localStorage is OUR OWN writer here, not an
// external boundary, so a stored value that doesn't match the shape this
// module itself wrote is a bug, not an expected malformed input -- it
// throws rather than silently discarding the draft or falling back to a
// default.
export interface ComposeDraft {
  templateName: string | null;
  subject: string;
  recipientCount: number;
  updatedAt: number;
}

// DEC-621 (wave-25 amendment): storageKey carries no user/org scoping, so on
// a shared browser (including the seeded demo personas an eval judge
// drives) the next organizer's Comms 390 landing rendered the PREVIOUS
// user's subject line and recipient count inside this frame's "Draft in
// progress" card. clearAllComposeDrafts() below is the sign-out-time fix;
// COMPOSE_DRAFT_KEY_PREFIX is hoisted here so storageKey and the sweep share
// one source for the prefix.
const COMPOSE_DRAFT_KEY_PREFIX = 'chq.composeDraft.';

function storageKey(eventId: string): string {
  if (!eventId) throw new Error('composeDraft: eventId is required');
  return `${COMPOSE_DRAFT_KEY_PREFIX}${eventId}`;
}

function assertValidDraft(value: unknown): asserts value is ComposeDraft {
  if (typeof value !== 'object' || value === null) {
    throw new Error('composeDraft: stored record is not an object');
  }
  const record = value as Record<string, unknown>;
  if (record.templateName !== null && typeof record.templateName !== 'string') {
    throw new Error('composeDraft: templateName must be a string or null');
  }
  if (typeof record.subject !== 'string') {
    throw new Error('composeDraft: subject must be a string');
  }
  if (typeof record.recipientCount !== 'number' || !Number.isInteger(record.recipientCount) || record.recipientCount < 0) {
    throw new Error('composeDraft: recipientCount must be a non-negative integer');
  }
  if (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) {
    throw new Error('composeDraft: updatedAt must be a number');
  }
}

/** Reads the draft for `eventId`, or null when none is stored. A stored
 * value that fails to parse or doesn't match the shape this module wrote
 * THROWS -- see the module doc comment. */
export function readComposeDraft(eventId: string): ComposeDraft | null {
  const raw = window.localStorage.getItem(storageKey(eventId));
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  assertValidDraft(parsed);
  return parsed;
}

/** Writes the draft for `eventId`. Called on each ComposeWizard step
 * advance -- never on keystroke. */
export function writeComposeDraft(eventId: string, draft: ComposeDraft): void {
  assertValidDraft(draft);
  window.localStorage.setItem(storageKey(eventId), JSON.stringify(draft));
}

/** Clears the draft for `eventId`, e.g. on a successful send. */
export function clearComposeDraft(eventId: string): void {
  window.localStorage.removeItem(storageKey(eventId));
}

/** Clears every stored compose draft, across all events. Called from
 * signOut() (DEC-621 wave-25 amendment) so a shared browser never carries
 * one organizer's in-progress draft into the next organizer's session --
 * see the module doc comment above COMPOSE_DRAFT_KEY_PREFIX. Collects the
 * matching keys first and only then removes them, so removing a key mid-scan
 * can't shift `localStorage`'s live index and skip the next one. */
export function clearAllComposeDrafts(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key !== null && key.startsWith(COMPOSE_DRAFT_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}
