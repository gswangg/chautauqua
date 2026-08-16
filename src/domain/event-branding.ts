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

/** Always returns a present object. `logoUrl` is present in the result only
 * when safeImageSrc accepts the stored value -- a hostile or malformed
 * logoUrl is dropped entirely, not replaced with a placeholder. `accentColor`
 * passes through verbatim: hex-grammar validation stays at the render edge
 * (validAccent/normalizeHexColor, DEC-374) and is NOT duplicated here. */
export function parseEventBranding(json: string | null | undefined): EventBranding {
  if (!json) return {};
  const parsed = JSON.parse(json) as { logoUrl?: string; accentColor?: string };
  const out: EventBranding = {};
  const safe = safeImageSrc(parsed.logoUrl);
  if (safe !== null) out.logoUrl = safe;
  if (parsed.accentColor !== undefined) out.accentColor = parsed.accentColor;
  return out;
}
