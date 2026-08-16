// Files repo — central files library (DEC-159/160/344), event-scoped
// deliverable version chains.
//
// Decomposed (contention custodian pass, 837 lines -> submodules) — this
// file is now a re-export barrel so every existing import path
// (`from "./files-library"` / `from "../files-library"` / files.ts's own
// `export * from "./files-library"`) keeps working unchanged:
//   files-library-scope.ts   event files scope (org/slug) + HEADSHOT_KIND/
//                             MAX_FILE_LIBRARY_SCAN constants
//   files-library-chains.ts  DeliverableFileRow + findRoot/loadDeliverable
//                             Chains version-chain grouping (also imported
//                             directly by submissions/list.ts)
//   files-library-query.ts   WHERE-clause builders + computeKindCounts
//   files-library-list.ts    listEventDeliverableFiles (the paginated list)
//   files-library-resolve.ts resolveLatestVersions (ZIP/download path)
//
// DEC-344: this module is server-paginated/server-filtered — one paginated
// statement over chain ROOTS (previous_file_id is null) per the DEC-333/335
// scale rule, never a whole-event scan. resolveLatestVersions likewise never
// scans the event's submissions; it only ever loads the requested files'
// own submissions/version chains.
import { DEC_680, DEC_773, DEC_902 } from "../../decisions";

void DEC_680;
void DEC_773;
void DEC_902;

export * from "./files-library-scope";
export * from "./files-library-chains";
export * from "./files-library-query";
export * from "./files-library-list";
export * from "./files-library-resolve";
