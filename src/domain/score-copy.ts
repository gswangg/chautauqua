// DEC-147 amendment (w62-d): one grammar for a blended score's copy. Before
// this file, five renderers hand-rolled the same value at two different
// precisions ('.toFixed(1)' vs Scorecard's plain-average hint at
// '.toFixed(2)') and three spellings of "no score yet" (a bare em dash, a
// ternary against `null`, and a ternary against `typeof x === 'number'`).
// This module is the single source for how a blended score reads on a
// human screen. It replaces:
//   - app/src/pages/review/ResultsTable.tsx (row.average, ev.score)
//   - app/src/pages/submissions/SubmissionDetailPage.tsx (ev.score)
//   - app/src/pages/review/ReviewerQueue.tsx (item.myScore)
//   - app/src/pages/review/Scorecard.tsx (overallScore, plainAverage hint)
//
// src/routes/review/plans-progress.ts's CSV export is deliberately NOT part
// of this module's population: a CSV is data, not copy, and keeps its own
// '.toFixed(2)' — see the comment at that call site.
export const SCORE_EMPTY_TOKEN = "—";

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return SCORE_EMPTY_TOKEN;
  }
  return value.toFixed(1);
}
