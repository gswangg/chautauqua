// DEC-454: one canonical email rule, applied at every contact.email write
// and every lookup by email. Pure core (DEC-002): no node:/cloudflare/
// drizzle imports.

export const MAX_EMAIL_LENGTH = 254;
export const MAX_EMAIL_LOCAL_LENGTH = 64;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

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
  const at = normalized.indexOf("@");
  const local = normalized.slice(0, at);
  if (local.length > MAX_EMAIL_LOCAL_LENGTH) {
    return false;
  }
  return true;
}
