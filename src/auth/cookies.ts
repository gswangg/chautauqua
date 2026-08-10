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

export function clearSessionCookie(): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
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
      cookies[name] = decodeURIComponent(value);
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
