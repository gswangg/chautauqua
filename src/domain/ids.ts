// Pure ID + human-ref helpers (DEC-003). Web APIs only — no node:/cloudflare imports (DEC-002).

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const ID_LENGTH = 20;

/** 20-char lowercase base32 id from crypto.getRandomValues, per DEC-003 primary key strategy. */
export function newId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    const byte = bytes[i];
    assert(byte !== undefined, "expected byte at index");
    out += BASE32_ALPHABET[byte % BASE32_ALPHABET.length];
  }
  return out;
}

/**
 * Human display ref, e.g. formatRef('SES', 14) === 'SES-014'.
 * Zero-padded to 3 digits; widens (no truncation) once seq exceeds 999.
 */
export function formatRef(prefix: string, seq: number): string {
  assert(Number.isInteger(seq) && seq >= 0, "seq must be a non-negative integer");
  const width = Math.max(3, String(seq).length);
  return `${prefix}-${String(seq).padStart(width, "0")}`;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
