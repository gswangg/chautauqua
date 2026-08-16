// Submission sort order vocabulary (DEC-613 wave-68 amendment). ONE set,
// shared by both consumers that previously kept their own copy:
//   - src/server/repo/submissions/query.ts (readSortToken parses/validates
//     the `sort` query token for the admin list route, its CSV export, and
//     the saved-view validator in src/server/repo/views.ts)
//   - app/src/pages/submissions/types.ts (the SubmissionsFilterState shape
//     the submissions page's <select>, saved views, and URL restore share)
//
// 'worklist' is a real member: it is the content app's server-side ordering
// (app/src/pages/content/ContentApp.tsx sends sort=worklist) and a saved
// view created through the API may legitimately carry it. It is
// deliberately NOT offered in the submissions page's own sort <select> —
// see PICKABLE_SORT_ORDERS in app/src/pages/submissions/FilterBar.tsx — but
// sortLabel() must still resolve it to a real label so a saved view or URL
// carrying 'worklist' never renders a blank option.
import { DEC_613 } from '../decisions';

void DEC_613; // wave-68 amendment: one shared sort-order vocabulary, not a second copy

// DEC-180 wave-79 amendment: ONE declaration (the array), the type derived
// via `typeof ARR[number]` -- the idiom already in the tree at
// src/domain/acceptance.ts:162-171 -- instead of a type union and a value
// array separately re-listing the same five literals in this same file.
export const SORT_ORDERS = ['newest', 'oldest', 'title', 'ref', 'worklist'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];
