// One parser for event.branding_json (DEC-322 wave-78 amendment). Pure
// module per DEC-002 -- Web APIs only, no node:/cloudflare imports.
//
// Before this file existed, event.branding_json had three parsers and two
// shapes: server/repo/events.ts's toBranding (returned EventBranding | null,
// no sanitization) and byte-identical hand-parses in routes/public/shell.tsx
// and routes/public/submit-views.tsx (returned {} when absent, and DID
// sanitize logoUrl through safeImageSrc). parseEventBranding below is the
// one door: it always returns a present object (never null), so every
// caller stops null-checking `.branding`, and it always sanitizes logoUrl
// so a legacy stored value written before the DEC-322 gate existed can never
// reach an <img src>.

import { safeImageSrc } from "./brand-url";

export interface EventBranding {
  logoUrl?: string;
  accentColor?: string;
}

/** Thrown by parseEventBranding when the stored event.branding_json does
 * not match the shape the column is contracted to hold -- names the
 * offending key so a corrupt/legacy row is loud, not a bare TypeError from
 * a property access on `null`. */
export class EventBrandingJsonError extends Error {
  constructor(detail: string) {
    super(`event.branding_json: ${detail}`);
    this.name = "EventBrandingJsonError";
  }
}

/** Always returns a present object. `logoUrl` is present in the result only
 * when safeImageSrc accepts the stored value -- a hostile or malformed
 * logoUrl is DROPPED entirely (not replaced with a placeholder, and not a
 * throw: src/routes/api/events.ts's write door already rejects an unsafe
 * logoUrl before it can be stored, so a row that fails safeImageSrc here can
 * only be a legacy row written before that DEC-322 gate existed, and
 * dropping it is the documented, deliberate behavior). `accentColor`'s
 * TYPE is validated (must be a string when present) but its hex GRAMMAR is
 * deliberately NOT re-validated here -- that check stays at the render edge
 * (validAccent/normalizeHexColor, DEC-374) and duplicating it here would be
 * a second, divergent copy of the same rule. */
export function parseEventBranding(json: string | null | undefined): EventBranding {
  if (!json) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new EventBrandingJsonError("not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new EventBrandingJsonError("must be an object");
  }
  const input = parsed as Record<string, unknown>;
  if (input.logoUrl !== undefined && typeof input.logoUrl !== "string") {
    throw new EventBrandingJsonError("logoUrl must be a string");
  }
  if (input.accentColor !== undefined && typeof input.accentColor !== "string") {
    throw new EventBrandingJsonError("accentColor must be a string");
  }
  const out: EventBranding = {};
  const safe = safeImageSrc(input.logoUrl as string | undefined);
  if (safe !== null) out.logoUrl = safe;
  if (input.accentColor !== undefined) out.accentColor = input.accentColor as string;
  return out;
}
