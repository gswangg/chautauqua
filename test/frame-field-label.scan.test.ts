// RETIRED (wave-28, DEC-613 amendment): this file and
// test/drawn-field-label.scan.test.ts landed in the same merge train both
// claiming the pack's drawn FIELD-label population and disagreed by 14x
// (73/71 vs 5). test/drawn-field-label.scan.test.ts is the survivor: its
// per-row hand-graded population (STORED/HARDCODED-MATCHES/
// HARDCODED-DIVERGES/UNRESOLVED, each with an individually verified reason
// and citation) is the tighter, correct derivation -- this file's own
// "within 5 lines, font-size:1[12]px" grammar was measured to admit 62
// false positives the survivor correctly excludes (section eyebrows,
// status-legend words, buttons, char counters, chip-group headings caught
// only because SOME unrelated bordered box happened to sit within its own
// 5-line forward window) against 7 rows the survivor's own tighter
// immediate-adjacency grammar had missed and has since absorbed (5
// STORED "Abstract" FormFieldDef rows, "Why them" MATCHES, and one real
// new DIVERGES -- Submissions.dc.html:693 "Options · one per line" vs.
// FieldModal.tsx's "Options (one per line)"). See
// docs/design/audit/drawn-field-label-v12.md for the full row-by-row
// ledger and src/decisions-data/DEC-613.md's wave-28 amendment for the
// full symmetric-difference evidence. This file is kept, never deleted,
// so the duplication and its resolution stay visible in the tree; its
// FRAME_FIELD_LABEL_DIVERGENCE_CEILING / FRAME_FIELD_LABEL_UNRESOLVED_
// CEILING constants are retired and no longer registered in
// scripts/exit-predicate.ts.
import { describe, it } from 'vitest';

describe('frame field-label ledger (RETIRED wave-28, DEC-613 amendment)', () => {
  it('retired in favor of test/drawn-field-label.scan.test.ts -- see this file\'s own header', () => {
    // Intentionally empty: this file's population and ceilings are gone,
    // not silently repurposed. A future lane needing this population
    // should extend the survivor, never resurrect this grammar.
  });
});
