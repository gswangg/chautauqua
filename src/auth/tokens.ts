// Session token primitives per DEC-004: 32 random bytes, b64url, with
// SHA-256 hex stored server-side in auth_session.token_hash.
// Pure Web Crypto only (DEC-002) — no node:/cloudflare imports.

const TOKEN_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return toBase64Url(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// Bearer API tokens (DEC-027)
// ---------------------------------------------------------------------------

const API_TOKEN_PREFIX = "chq_";
const API_TOKEN_BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const API_TOKEN_RANDOM_CHARS = 40;
// First 12 plaintext chars (prefix included) are stored for display.
export const API_TOKEN_DISPLAY_PREFIX_LENGTH = 12;

/** Plaintext bearer token: 'chq_' + 40 lowercase base32 chars, shown exactly
 * once at creation (DEC-027). */
export function newApiToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(API_TOKEN_RANDOM_CHARS));
  let suffix = "";
  for (let i = 0; i < API_TOKEN_RANDOM_CHARS; i++) {
    suffix += API_TOKEN_BASE32_ALPHABET[bytes[i]! % API_TOKEN_BASE32_ALPHABET.length];
  }
  return `${API_TOKEN_PREFIX}${suffix}`;
}

/** First 12 plaintext chars of a bearer token, for display (DEC-027). */
export function apiTokenDisplayPrefix(plaintext: string): string {
  return plaintext.slice(0, API_TOKEN_DISPLAY_PREFIX_LENGTH);
}
