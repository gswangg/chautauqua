// DEC-454: one canonical email rule, applied at every contact.email write
// and every lookup by email. Pure core (DEC-002): no node:/cloudflare/
// drizzle imports.

export const MAX_EMAIL_LENGTH = 254;
export const MAX_EMAIL_LOCAL_LENGTH = 64;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// DEC-454 amendment (wave 24): the intake half of the serializer boundary.
// src/mail/email-binding.ts's `addressValue` strips exactly this character
// class before interpolating an address into a raw MIME `<...>` header (and,
// via src/mail/ics.ts, a `mailto:` URI) — closing an injection but, left
// unmatched at intake, opening a quieter split: the app would store/display/
// log one address and mail a DIFFERENT (stripped) one. Rejecting these
// characters here keeps intake and the serializer in agreement: whatever
// isValidEmail accepts, addressValue leaves byte-for-byte unchanged.
// eslint-disable-next-line no-control-regex
export const ADDRESS_FORBIDDEN_RE = /[\x00-\x1f\x7f<>,;"\\\s]/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const normalized = normalizeEmail(raw);
  if (normalized.length === 0 || normalized.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    return false;
  }
  if (ADDRESS_FORBIDDEN_RE.test(normalized)) {
    return false;
  }
  const at = normalized.indexOf("@");
  const local = normalized.slice(0, at);
  if (local.length > MAX_EMAIL_LOCAL_LENGTH) {
    return false;
  }
  return true;
}
