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

export type SortOrder = 'newest' | 'oldest' | 'title' | 'ref' | 'worklist';

export const SORT_ORDERS: readonly SortOrder[] = ['newest', 'oldest', 'title', 'ref', 'worklist'];
