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
// Fail loudly (house rule), refined by `app/src/pages/comms/composeDraft.ts`
// (DEC-621 wave-33): the SHAPE this module writes is ours and stays loud --
// a caller handing writeComposeDraft a malformed ComposeDraft is a bug and
// throws. But the STORE is not our writer, it is a boundary: localStorage
// outlives deploys, tabs, and shape migrations, so a record written by a
// past version of this module (or corrupted by the browser) is an expected
// external input, not a programming error. An unreadable record is evicted
// and reported as absent (null) rather than crashing the page that is the
// organizer's only path back to a working compose flow -- see DEC-621
// wave-33 for the live /comms outage this replaces.
export interface ComposeDraft {
  templateName: string | null;
  subject: string;
  recipientCount: number;
  updatedAt: number;
}

function storageKey(eventId: string): string {
  if (!eventId) throw new Error('composeDraft: eventId is required');
  return `chq.composeDraft.${eventId}`;
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
 * value that fails to parse or doesn't match the shape this module writes
 * is an unreadable record from the storage boundary (DEC-621 wave-33): it
 * is evicted (removeItem) and treated as absent, returning null. Caller
 * errors (e.g. an empty eventId) still throw from storageKey above. */
export function readComposeDraft(eventId: string): ComposeDraft | null {
  const key = storageKey(eventId);
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    assertValidDraft(parsed);
    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

/** Writes the draft for `eventId`. Called on each ComposeWizard step
 * advance -- never on keystroke. The shape is validated first and still
 * throws loudly on a caller bug; only the localStorage.setItem call itself
 * is guarded (DEC-621 wave-33) -- a storage exception (quota, Safari
 * private mode) abandons the write and evicts the key so a truncated
 * record can never be read back. */
export function writeComposeDraft(eventId: string, draft: ComposeDraft): void {
  assertValidDraft(draft);
  const key = storageKey(eventId);
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    window.localStorage.removeItem(key);
  }
}

/** Clears the draft for `eventId`, e.g. on a successful send. */
export function clearComposeDraft(eventId: string): void {
  window.localStorage.removeItem(storageKey(eventId));
}
