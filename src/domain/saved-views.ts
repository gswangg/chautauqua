// Saved view caps (DEC-031, DEC-422). Pure core: no node:/cloudflare/drizzle
// imports (DEC-002). Bounds the three previously-unbounded surfaces on
// src/server/repo/views.ts's config_json shape and the per-event view
// collection: q length (existing MAX_TEXT_LENGTH), trackId length (existing
// MAX_NAME_LENGTH), column count, and per-column length (existing
// MAX_NAME_LENGTH). The view NAME cap already lives at MAX_NAME_LENGTH via
// src/routes/api/views.ts's parseBoundedText -- this module does not
// duplicate that.

import { DEC_031, DEC_422 } from "../decisions";

void DEC_031;
void DEC_422;

/** Max saved views (of any visibility) one organiser may create per event.
 * Enforced in src/routes/api/views.ts's POST handler before createSavedView. */
export const MAX_SAVED_VIEWS_PER_EVENT = 50;

/** Max entries in a saved view's `columns` array. Enforced in
 * src/server/repo/views.ts's isValidSavedViewConfig. */
export const MAX_SAVED_VIEW_COLUMNS = 40;
