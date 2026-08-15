// Saved embed cap (DEC-822). Pure core: no node:/cloudflare/drizzle imports
// (DEC-002), same purity contract as src/domain/saved-views.ts.
//
// Scoping contract: this cap is EVENT-WIDE, not per-author. A saved view
// has an owner and a shared flag, so its cap (MAX_SAVED_VIEWS_PER_EVENT in
// src/domain/saved-views.ts) counts only the caller's own rows -- counting
// other organisers' shared views there would let a handful of shared rows
// permanently lock every colleague in the org out. A saved embed has NO
// per-organiser ownership at all: it is a published artifact of the event
// (live HTML pasted on somebody else's site), not a personal workspace
// object. So this cap counts every embed on the event regardless of who
// created it -- that is by construction, not by oversight, because there
// is no "your embeds" scope to count instead.

import { DEC_822 } from "../decisions";

void DEC_822;

/** Max saved embeds (of any surface/format/enabled state) an event may
 * have, counted across ALL organisers on the event (see scoping contract
 * above). Enforced in src/routes/api/embeds.ts's POST handler before
 * createEmbed. */
export const MAX_SAVED_EMBEDS_PER_EVENT = 50;
