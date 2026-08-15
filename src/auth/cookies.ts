// Cookie + CSRF helpers per DEC-004.
// Session cookie: 'chq_session', HttpOnly, SameSite=Lax, Path=/, Max-Age 30d,
// Secure only when the request proto is https (caller decides via `secure`).
// CSRF: JSON mutations under /api/v1 require header 'x-chq-csrf: 1'; plain
// HTML form posts use a double-submit cookie 'chq_csrf'.
// Pure Web Crypto only (DEC-002) — no node:/cloudflare imports.

export const SESSION_COOKIE_NAME = "chq_session";
export const CSRF_COOKIE_NAME = "chq_csrf";
export const CSRF_HEADER = "x-chq-csrf";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export interface SessionCookieOptions {
  secure: boolean;
}

export function buildSessionCookie(token: string, options: SessionCookieOptions): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${THIRTY_DAYS_SECONDS}`,
  ];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function clearSessionCookie(options: SessionCookieOptions): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) {
    return cookies;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const name = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (name) {
      // Boundary input: cookie values arrive from the client and are not
      // guaranteed to be valid percent-encoding (e.g. a stray '%' from a
      // third-party cookie on the domain). Decode per-cookie so one
      // malformed value can't throw and abandon the whole header. Our own
      // minted tokens (session/csrf/draft) are base64url or hex, which is
      // byte-identical whether or not decodeURIComponent runs, so falling
      // back to the raw value is safe for everything we issue.
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    }
  }
  return cookies;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

// DEC-228: shared Secure-request check, consolidated from the duplicated
// `isSecureRequest` helpers previously in src/routes/auth.tsx and
// src/routes/account.tsx.
export function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === "https:";
}

export interface CsrfCookieOptions {
  secure: boolean;
}

// DEC-228: CSRF double-submit cookie, now HttpOnly (nothing client-side
// reads it — JSON CSRF uses the static x-chq-csrf header and SSR forms
// carry the token as a server-rendered hidden field).
export function buildCsrfCookie(token: string, options: CsrfCookieOptions): string {
  const attributes = [`${CSRF_COOKIE_NAME}=${token}`, "HttpOnly", "Path=/", "SameSite=Lax"];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

// DEC-228: draft-resume cookie, scoped to /submit, now HttpOnly for the same
// reason as the CSRF cookie above.
export function buildDraftCookie(name: string, token: string, options: CsrfCookieOptions): string {
  const attributes = [`${name}=${token}`, "HttpOnly", "Path=/submit", "SameSite=Lax"];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}
