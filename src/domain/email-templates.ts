// Email template cap (DEC-660 wave-23 amendment). Pure core: no
// node:/cloudflare/drizzle imports (DEC-002), same purity contract and
// shape as src/domain/saved-views.ts and src/domain/embeds.ts.
//
// POST /api/v1/events/:eventId/templates (src/routes/comms/templates.ts)
// wrote an email_template row with no bound of any kind before this cap
// existed -- unlike its documented siblings (saved views, saved embeds,
// breaks, API tokens, participants), which each declare a cap in pure core.
// The door also carries csrfJson but not requireCookieSession, so it is
// bearer-reachable (DEC-027), and each row can hold MAX_RICH_TEXT_LENGTH
// (100,000) characters of bodyText.

import { DEC_660 } from "../decisions";

void DEC_660;

/** Max email templates (of any kind) one event may have. Enforced in
 * src/server/repo/comms.ts's createTemplate, PRE-WRITE, via countTemplates
 * -- the same read-then-refuse idiom src/server/repo/participants.ts uses
 * at its MAX_PARTICIPANTS_PER_SUBMISSION guard. The cap lives at the repo
 * layer (not the route) so every future caller of createTemplate inherits
 * it. */
export const MAX_EMAIL_TEMPLATES_PER_EVENT = 50;
