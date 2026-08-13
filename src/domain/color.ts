// ONE hex-colour grammar (DEC-371 amendment, wave 43). Every reader of a
// user-supplied hex colour — API validators, SSR accent guards, the embed
// query parser, the client settings form — delegates here rather than
// carrying its own regex, so a value the writer accepted can never be
// silently discarded by a reader with a stricter (or differently-shaped)
// pattern. Pure core: no node:/cloudflare imports.

const HEX3_OR_6_RE = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Accepts an optional leading '#', 3 or 6 hex digits. A 3-digit value is
 * expanded (e.g. 'abc' -> 'aabbcc'). Returns lowercase '#rrggbb', or null
 * for anything else (wrong length, non-hex characters, empty/nullish).
 */
export function normalizeHexColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.startsWith("#") ? raw.slice(1) : raw;
  if (!HEX3_OR_6_RE.test(stripped)) return null;
  const hex = stripped.length === 3 ? stripped.split("").map((c) => c + c).join("") : stripped;
  return `#${hex.toLowerCase()}`;
}

/** True whenever normalizeHexColor would accept `raw`. */
export function isValidHexColor(raw: string): boolean {
  return normalizeHexColor(raw) !== null;
}
