// DEC-988 (wave-77 amendment): the ONE author for "what does an event with
// no portal_settings row look like?" Pure core (DEC-002: no node:/cloudflare
// imports) so both the server and the SPA (via a single DEC-660-style
// crossing module) can read the same answer instead of restating it.
//
// WHY visible (showResources: true) is the honest default: an event whose
// producer never opened the Speaker-portal panel has never made a choice,
// so it carries the column's own DEFAULT (src/db/schema/content.ts) rather
// than an invented one. Defaulting hidden instead would retroactively blank
// the portal's Resources section for every event created before the toggle
// existed — a silent behaviour change with no user action behind it. This
// ruling changes NO behaviour anywhere; every one of the eight sites already
// agreed on these four values. It buys one author, not a new policy.
export const DEFAULT_PORTAL_SETTINGS = {
  logoUrl: null,
  accentColor: null,
  welcomeMessage: null,
  showResources: true,
} as const;
