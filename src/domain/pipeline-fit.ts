// CRM sourcing pipeline fit (CRM-07/08, DEC-821). Pure core: no node:/cf
// imports, no ApiError (that's a route-layer concern -- see
// src/routes/api/pipeline.ts's validateFitScore/validateRationale). fit_score
// is an integer 1-5 (or null, meaning unrated -- a visible state, never an
// implied zero); rationale is a bounded one-liner. Fit ranks cards WITHIN a
// stage column only -- it never reorders or crosses stages, since stage is
// the fact the board is about (this module has no notion of "stage" at all
// beyond what the caller passes in). Shared between server and the app SPA
// (imported by app/src/pages/contacts/PipelineBoard.tsx), which is why the
// bounds live here rather than duplicated in both places.

import { DEC_821 } from "../decisions";

// Compile-checked dependency on DEC-821 (see file header).
export const PIPELINE_FIT_DECISION = DEC_821;

export const PIPELINE_FIT_MIN = 1;
export const PIPELINE_FIT_MAX = 5;
export const PIPELINE_RATIONALE_MAX_LEN = 500;

export interface FitRankable {
  fitScore: number | null;
}

/** Orders entries by fit score descending, unrated (null) last. Ties are
 * left in their incoming relative order (stable sort) -- this function has
 * no opinion about a secondary key like name or age. Callers must only ever
 * apply this WITHIN one stage's cards; it never moves a card between
 * stages, because it never looks at stage at all. */
export function sortByFit<T extends FitRankable>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.fitScore === b.fitScore) return 0;
    if (a.fitScore === null) return 1;
    if (b.fitScore === null) return -1;
    return b.fitScore - a.fitScore;
  });
}
