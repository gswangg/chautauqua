// Password hashing per DEC-004: PBKDF2-SHA256, 600000 iterations,
// 16-byte random salt, 32-byte derived key, stored as
// 'pbkdf2$v1$600000$<salt-b64url>$<hash-b64url>'.
// Pure Web Crypto only (DEC-002) — no node:/cloudflare imports.

const ALGORITHM = "pbkdf2";
const VERSION = "v1";
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_BYTES * 8
  );
  return new Uint8Array(derivedBits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveKey(password, salt);
  return `${ALGORITHM}$${VERSION}$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] as number) ^ (b[i] as number);
  }
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5) {
    throw new Error(`Malformed password hash: expected 5 fields, got ${parts.length}`);
  }
  const [algorithm, version, iterationsRaw, saltB64, hashB64] = parts;
  if (algorithm !== ALGORITHM) {
    throw new Error(`Malformed password hash: unknown algorithm '${algorithm}'`);
  }
  if (version !== VERSION) {
    throw new Error(`Malformed password hash: unknown version '${version}'`);
  }
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error(`Malformed password hash: invalid iterations '${iterationsRaw}'`);
  }
  if (!saltB64 || !hashB64) {
    throw new Error("Malformed password hash: missing salt or hash segment");
  }

  const salt = fromBase64Url(saltB64);
  const expected = fromBase64Url(hashB64);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    expected.length * 8
  );
  return constantTimeEqual(new Uint8Array(derivedBits), expected);
}
