// Content-status vocabulary (DEC-003 wave-73 amendment). ONE set, shared by
// every consumer that previously kept its own copy:
//   - src/server/repo/files-content-status.ts (re-exports CONTENT_STATUSES/
//     ContentStatus verbatim -- the module still owns the DB-touching helpers)
//   - src/routes/files.ts / src/routes/api/submissions.ts (refusal copy)
//   - src/server/repo/submissions/list.ts (worklist chip counts)
//   - app/src/pages/content/types.ts (re-exports the type)
//
// Pure core (DEC-002): no node:/cloudflare/drizzle imports, so both the
// server repo layer and the SPA can share this. Modeled on
// src/domain/task-kinds.ts.
import { DEC_003 } from "../decisions";

void DEC_003; // wave-73 amendment: one shared content-status vocabulary, not four copies

export const CONTENT_STATUSES = ["pending", "approved", "changes_requested"] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isContentStatus(value: string): value is ContentStatus {
  return (CONTENT_STATUSES as readonly string[]).includes(value);
}
